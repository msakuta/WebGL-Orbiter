mod utils;

use wasm_bindgen::prelude::*;

use ::cgmath::{InnerSpace as _, Rotation as _, Zero};
use ::js_sys::{Array, Function, Object, Reflect};
use ::orbiter_logic::{
    dyn_iter::DynIter, quaternion::QuaternionDeserial, CelestialBody, CelestialBodyComb,
    CelestialBodyImComb, CelestialId, SetRocketStateWs, Universe, Vector3, WsMessage,
};
use ::serde::Deserialize;
use std::collections::HashMap;

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
    let bodies = CelestialBodyImComb::new_all(&universe.bodies);

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
    console_log!("Time: {}, {} bodies", now_unix, universe.bodies.len());
    universe.deserialize(json).unwrap();
    console_log!("{} bodies after deserialize", universe.bodies.len());

    for body in universe.iter_bodies().dyn_iter() {
        console_log!("session_id: {:?} q: {:?}", body.session_id, body.quaternion);
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
    pub fn set_body_model(&mut self, name: &str, js_body: Object) {
        if let Some((_, body)) = self.universe.find_by_name_mut(name) {
            let get_model_id = |js_body: &Object| {
                Reflect::get(&js_body, &JsValue::from("model"))
                    .and_then(|model| Reflect::get(&model, &JsValue::from("id")))
                    .ok()
                    .and_then(|o| o.as_f64())
                    .unwrap_or(0.)
            };
            console_log!("Setting model {} to {}!", get_model_id(&js_body), name);
            body.js_body = JsValue::from(js_body);
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
        let mut control_commands = HashMap::new();
        for _ in 0..div {
            self.universe.simulate_bodies(delta_time, div, &mut |obj, id, others| {
                if select_id == Some(id) && /*gameState.sessionId === a.sessionId && */ obj.controllable /* && timescale <= 1*/ {
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
                            console_log!("rotation: {} parent: {:?}", obj.quaternion.magnitude2(), others);
                            // We want to send decelerate commands to the server until the rotation stops, otherwise it will rotate forever.
                            control_commands.insert(id, force_send_command);
                        } else {
                            obj.angular_velocity.set_zero();
                        }
                    } else {
                        control_commands.insert(id, false);
                    }
                }
            });
        }

        for (command, force_send_command) in control_commands {
            let mut bodies = CelestialBodyImComb::new_all(&self.universe.bodies);
            if let (Some(obj), others) = bodies
                .exclude_id(command)
                .map_err(|e| JsValue::from_str(&e.to_string()))?
            {
                if let Ok(obj) = serde_json::to_string(&WsMessage::SetRocketState(
                    SetRocketStateWs::from(obj, &others),
                )) {
                    if let Err(e) = send_control_command.call2(
                        &JsValue::NULL,
                        &JsValue::from_str(&obj),
                        &JsValue::from_bool(force_send_command),
                    ) {
                        console_log!("Error in send_control_command: {:?}", e);
                    }
                }
            }
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

        let body_iter = CelestialBodyImComb::new_all(&self.universe.bodies);
        let center = select_obj.map(|obj| obj.get_world_position(&body_iter));

        // console_log!("select_obj: {:?}", center);

        let build_args = |body: &CelestialBody| -> anyhow::Result<Array> {
            let mut position = body.get_world_position(&body_iter);
            if let Some(center) = center {
                position -= center;
            }

            let arr = Array::new();

            arr.push(&JsValue::from_str(&serde_json::to_string(&body.position)?));
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

    pub fn for_each_body(&mut self, f: Function) -> Result<(), JsValue> {
        let bodies = &mut self.universe.bodies;
        for i in 0..bodies.len() {
            let (body, others) =
                CelestialBodyComb::new(bodies, i).map_err(|e| JsValue::from_str(&e.to_string()))?;
            let body = if let Some(body) = body.dynamic.as_mut() {
                body
            } else {
                continue;
            };
            let payload =
                serde_json::to_string(&body.to_add_model(&CelestialBodyImComb::from(&others)))
                    .map_err(|e| JsValue::from_str(&e.to_string()))?;

            body.js_body = f.call1(&JsValue::NULL, &JsValue::from_str(&payload))?;
            console_log!("Setting js_body to {}!", body.name);
        }
        Ok(())
    }
}
