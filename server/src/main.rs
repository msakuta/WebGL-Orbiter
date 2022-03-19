use orbiter_logic::Universe;

fn main() {
    let mut universe = Universe::new();
    let mut time = 0.;
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
        universe.update();
        println!("Tick {}: {:?}", time, universe);
        time += 1.;
    }
}
