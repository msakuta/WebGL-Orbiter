mod utils;

use wasm_bindgen::prelude::*;

use ::js_sys::{Function, Object, Reflect};
use ::orbiter_logic::Universe;
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
pub fn greet() {
    alert("Hello, orbiter-wasm!");
}

#[wasm_bindgen]
pub struct WasmState {
    universe: Universe,
    view_scale: f64,
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

    WasmState {
        universe,
        view_scale,
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
    pub fn set_body_model(&mut self, name: &str, model: Object) {
        if let Some((_, body)) = self.universe.find_by_name_mut(name) {
            console_log!(
                "Setting model {} to {}!",
                Reflect::get(&model, &JsValue::from("id"))
                    .ok()
                    .and_then(|o| o.as_f64())
                    .unwrap_or(0.),
                name
            );
            body.model = JsValue::from(model);
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
        self.universe.simulate_bodies(delta_time, div);
        Ok(())
    }

    pub fn update_model(&self, select_obj: &str, setter: &Function) -> Result<(), JsValue> {
        let select_obj = self.universe.find_by_name(select_obj);

        let center = select_obj.map(|(_, obj)| obj.get_world_position(&self.universe.bodies));

        // console_log!("select_obj: {:?}", center);

        for body in self
            .universe
            .bodies
            .iter()
            .filter_map(|body| body.dynamic.as_ref())
        {
            let mut position = body.get_world_position(&self.universe.bodies);
            if let Some(center) = center {
                position -= center;
            }
            position *= self.view_scale;

            setter.call2(
                &JsValue::undefined(),
                &body.model,
                &JsValue::from_serde(&position).map_err(|e| JsValue::from_str(&e.to_string()))?,
            )?;
        }
        Ok(())
    }
}
