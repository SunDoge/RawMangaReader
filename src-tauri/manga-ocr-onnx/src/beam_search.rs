#[derive(Debug)]
pub struct Beam {
    pub token_ids: Vec<i64>,
    pub log_prob: f32,
}

impl Beam {
    pub fn new(start_token_id: i64) -> Self {
        Self {
            token_ids: vec![start_token_id],
            log_prob: 0.0,
        }
    }
}
