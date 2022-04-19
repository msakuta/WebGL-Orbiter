mod utils;

use wasm_bindgen::prelude::*;

use ::cgmath::Zero;
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
    ) -> Result<(), JsValue> {
        let buttons: RotationButtons =
            serde_json::from_str(buttons).map_err(|e| JsValue::from_str(&e.to_string()))?;
        // console_log!("simulate_body: {}", delta_time);
        for _ in 0..div {
            self.universe.simulate_bodies(delta_time, div);
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
            // position *= self.view_scale;

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
            // if body.name == "venus" {
            //     console_log!("velo: {:?} pos: {:?} ang: {:?} incl: {:?}", body.velocity, body.position, elems.angular_momentum, elems.inclination);
            // }
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
