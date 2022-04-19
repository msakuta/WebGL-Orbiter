mod utils;

use wasm_bindgen::prelude::*;

use ::cgmath::{InnerSpace as _, Rotation as _, Zero};
use ::js_sys::{Array, Function, Object, Reflect};
use ::orbiter_logic::{
    quaternion::QuaternionDeserial, CelestialBody, CelestialBodyImDynIter, CelestialId, Universe,
    Vector3,
};
use ::serde::Deserialize;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    pub(crate) fn log(s: &str);
}

#[macro_export]
macro_rules! console_log {
    ($fmt:expr, $($arg1:expr),*) => {
        crate::log(&format!($fmt, $($arg1),+))
    };
    ($fmt:expr) => {
        crate::log($fmt)
    }
}

#[wasm_bindgen]
pub struct WasmState {
    universe: Universe,
    view_scale: f64,
    camera: Vector3,
    select_obj: Option<CelestialId>,
    nlips_enable: bool,
}

fn _print_bodies(universe: &Universe) {
    let bodies = CelestialBodyImDynIter::new_all(&universe.bodies);

    for body in universe
        .bodies
        .iter()
        .filter_map(|body| body.dynamic.as_ref())
    {
        console_log!(
            "Celbody[{}]: parent: {:?}, world_pos: {:?}",
            body.name,
            body.parent
                .and_then(|parent| bodies.get(parent))
                .map(|body| &body.name as &str)
                .unwrap_or_else(|| "<Null>"),
            body.get_world_position(&bodies)
        );
    }
}

#[wasm_bindgen]
pub fn load_state(json: JsValue, now_unix: f64, view_scale: f64) -> WasmState {
    utils::set_panic_hook();
    let json: serde_json::Value = json.into_serde().unwrap();
    let mut universe = Universe::new(now_unix);
    console_log!("Time: {}", now_unix);
    universe.deserialize(json).unwrap();

    if let Some(body) = universe
        .bodies
        .iter()
        .filter_map(|body| body.dynamic.as_ref())
        .find(|body| body.name == "earth")
    {
        console_log!("Celbody: {:#?}", body);
    }

    // print_bodies(&universe);

    WasmState {
        universe,
        view_scale,
        camera: Vector3::zero(),
        select_obj: None,
        nlips_enable: true,
    }
}

#[derive(Deserialize)]
struct RotationButtons {
    pub up: bool,
    pub down: bool,
    pub left: bool,
    pub right: bool,
    pub counterclockwise: bool,
    pub clockwise: bool,
}

impl RotationButtons {
    fn any(&self) -> bool {
        self.up || self.down || self.left || self.right || self.counterclockwise || self.clockwise
    }
}

#[wasm_bindgen]
impl WasmState {
    pub fn set_body_model(&mut self, name: &str, model: Object, js_body: JsValue) {
        if let Some((_, body)) = self.universe.find_by_name_mut(name) {
            let get_model_id = |model: &Object| {
                Reflect::get(&model, &JsValue::from("id"))
                    .ok()
                    .and_then(|o| o.as_f64())
                    .unwrap_or(0.)
            };
            console_log!("Setting model {} to {}!", get_model_id(&model), name);
            body.model = JsValue::from(model);
            body.js_body = js_body;
        }
    }

    pub fn simulate_body(
        &mut self,
        delta_time: f64,
        div: usize,
        buttons: &str,
        send_control_command: Function,
    ) -> Result<(), JsValue> {
        let buttons: RotationButtons =
            serde_json::from_str(buttons).map_err(|e| JsValue::from_str(&e.to_string()))?;
        // console_log!("simulate_body: {}", delta_time);
        let angle_acceleration = 1e-0 * delta_time / div as f64;
        let select_id = self.select_obj;
        for _ in 0..div {
            self.universe.simulate_bodies(delta_time, div, &|obj, id, others| {
                if select_id == Some(id) && /*gameState.sessionId === a.sessionId && */ obj.controllable /* && timescale <= 1*/ {
                    if buttons.any() {
                        console_log!("rotation: {}", obj.quaternion.magnitude2());
                    }
                    if buttons.up {
                        obj.angular_velocity += obj.quaternion.rotate_vector(Vector3::new(0., 0., 1.)) * angle_acceleration;
                    }
                    if buttons.down {
                        obj.angular_velocity += obj.quaternion.rotate_vector(Vector3::new(0., 0., -1.)) * angle_acceleration;
                    }
                    if buttons.left {
                        obj.angular_velocity += obj.quaternion.rotate_vector(Vector3::new(0., 1., 0.)) * angle_acceleration;
                    }
                    if buttons.right {
                        obj.angular_velocity += obj.quaternion.rotate_vector(Vector3::new(0., -1., 0.)) * angle_acceleration;
                    }
                    if buttons.counterclockwise {
                        obj.angular_velocity += obj.quaternion.rotate_vector(Vector3::new(1., 0., 0.)) * angle_acceleration;
                    }
                    if buttons.clockwise {
                        obj.angular_velocity += obj.quaternion.rotate_vector(Vector3::new(-1., 0., 0.)) * angle_acceleration;
                    }
                    if !buttons.any() {
                        // Immediately stop micro-rotation if the body is controlled.
                        // This is done to make it still in larger timescale, since micro-rotation cannot be canceled
                        // by product of angularVelocity and quaternion which underflows by square.
                        // Think that the vehicle has a momentum wheels that cancels micro-rotation continuously working.
                        const MICRO_ROTATION: f64 = 1e-6;
                        if MICRO_ROTATION < obj.angular_velocity.magnitude2() {
                            obj.angular_velocity += obj.angular_velocity.normalize() * -angle_acceleration;
                            let mut force_send_command = false;
                            if obj.angular_velocity.magnitude2() <= MICRO_ROTATION {
                                obj.angular_velocity.set_zero();
                                force_send_command = true;
                            }
                            // We want to send decelerate commands to the server until the rotation stops, otherwise it will rotate forever.
                            if let Ok(obj) = obj.to_server_command(others) {
                                if let Err(e) = send_control_command.call2(&JsValue::NULL, &JsValue::from_str(&obj), &JsValue::from_bool(force_send_command)) {
                                    console_log!("Error in send_control_command: {:?}", e);
                                }
                            }
                        } else {
                            obj.angular_velocity.set_zero();
                        }
                    }
                }
            });
        }
        self.universe.update_orbital_elements(self.select_obj);
        Ok(())
    }

    pub fn set_camera(&mut self, camera: &str) -> Result<(), JsValue> {
        self.camera =
            serde_json::from_str(camera).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(())
    }

    pub fn set_select_obj(&mut self, select_obj: &str) -> Result<(), JsValue> {
        let next = self.universe.find_by_name(select_obj).map(|(id, _)| id);

        // if next != self.select_obj {
        //     print_bodies(&self.universe);
        // }

        self.select_obj = next;

        Ok(())
    }

    pub fn update_model(&self, select_obj: &str, setter: &Function) -> Result<(), JsValue> {
        // let select_obj = self.universe.find_by_name(select_obj);
        let select_obj = self.select_obj.and_then(|id| self.universe.get(id));

        let body_iter = CelestialBodyImDynIter::new_all(&self.universe.bodies);
        let center = select_obj.map(|obj| obj.get_world_position(&body_iter));

        // console_log!("select_obj: {:?}", center);

        let build_args = |body: &CelestialBody| -> anyhow::Result<Array> {
            let mut position = body.get_world_position(&body_iter);
            if let Some(center) = center {
                position -= center;
            }

            let arr = Array::new();

            arr.push(&body.model);
            arr.push(&JsValue::from_str(&serde_json::to_string(&position)?));
            arr.push(&JsValue::from_f64(body.nlips_factor(
                &body_iter,
                select_obj,
                self.view_scale,
                &self.camera,
                self.nlips_enable,
            )));
            arr.push(&JsValue::from_str(&serde_json::to_string(
                &QuaternionDeserial::from(body.quaternion),
            )?));
            arr.push(&body.js_body);
            let elems = body.get_orbital_elements();
            arr.push(&JsValue::from_str(&serde_json::to_string(elems)?));
            Ok(arr)
        };

        for body in self
            .universe
            .bodies
            .iter()
            .filter_map(|body| body.dynamic.as_ref())
        {
            setter.apply(
                &JsValue::undefined(),
                &build_args(body).map_err(|e| JsValue::from_str(&e.to_string()))?,
            )?;
        }
        Ok(())
    }

    pub fn set_nonlinear_scale(&mut self, value: bool) {
        self.nlips_enable = value;
    }
}
