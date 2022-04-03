use crate::Quaternion;
use ::serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
pub struct QuaternionSerial {
    _x: f64,
    _y: f64,
    _z: f64,
    _w: f64,
}

impl From<QuaternionSerial> for Quaternion {
    fn from(serial: QuaternionSerial) -> Self {
        Self::new(serial._w, serial._x, serial._y, serial._z)
    }
}

impl From<Quaternion> for QuaternionSerial {
    fn from(q: Quaternion) -> Self {
        Self {
            _x: q.v.x,
            _y: q.v.y,
            _z: q.v.z,
            _w: q.s,
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, Copy)]
pub struct QuaternionDeserial {
    x: f64,
    y: f64,
    z: f64,
    w: f64,
}

impl From<QuaternionDeserial> for Quaternion {
    fn from(serial: QuaternionDeserial) -> Self {
        Self::new(serial.w, serial.x, serial.y, serial.z)
    }
}

impl From<Quaternion> for QuaternionDeserial {
    fn from(q: Quaternion) -> Self {
        Self {
            x: q.v.x,
            y: q.v.y,
            z: q.v.z,
            w: q.s,
        }
    }
}
