use crate::{
    dyn_iter::DynIter, quaternion::QuaternionSerial, CelestialBody, CelestialBodyImComb, Vector3,
};
use ::serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TimeScaleMessage {
    pub time_scale: f64,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SetRocketStateWs {
    pub name: String,
    pub parent: Option<String>,
    pub position: Vector3,
    pub velocity: Vector3,
    pub quaternion: QuaternionSerial,
    pub angular_velocity: Vector3,
}

impl SetRocketStateWs {
    pub fn from<'a>(body: &'a CelestialBody, bodies: &CelestialBodyImComb) -> Self {
        Self {
            name: body.name.clone(),
            parent: body
                .parent
                .and_then(|parent| bodies.get(parent))
                .map(|b| b.name.clone()),
            position: body.position,
            velocity: body.velocity,
            quaternion: body.quaternion.into(),
            angular_velocity: body.angular_velocity,
        }
    }

    pub fn update_body(self, target: &mut CelestialBody, others: &CelestialBodyImComb) {
        let parent = self
            .parent
            .and_then(|parent| others.find_with_id(|body| body.name == parent));
        target.parent = parent.map(|(id, _)| id);
        target.position = self.position;
        target.velocity = self.velocity;
        target.quaternion = self.quaternion.into();
        target.angular_velocity = self.angular_velocity;
    }
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum WsMessage {
    SetRocketState(SetRocketStateWs),
    Message { payload: String },
    TimeScale { payload: TimeScaleMessage },
    ChatHistoryRequest,
}
