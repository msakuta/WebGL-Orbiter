mod utils;

use wasm_bindgen::prelude::*;

use ::orbiter_logic::Universe;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    alert("Hello, orbiter-wasm!");
}

pub fn load_state(json: JsValue) {
    let mut universe = Universe::new();
    // universe.deserialize(json).unwrap();
}
