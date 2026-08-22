use std::sync::RwLock;

#[derive(Clone, Default)]
struct ProxyConfig {
    url: String,
    no_proxy: String,
}

#[derive(Default)]
pub struct NetworkState {
    proxy: RwLock<Option<ProxyConfig>>,
}

impl NetworkState {
    pub fn blocking_client(&self, user_agent: &str) -> Result<reqwest::blocking::Client, String> {
        let config = self
            .proxy
            .read()
            .map_err(|_| "HTTP proxy state lock is poisoned".to_string())?
            .clone();
        let mut builder = reqwest::blocking::Client::builder().user_agent(user_agent);
        if let Some(config) = config {
            let mut proxy = reqwest::Proxy::all(&config.url)
                .map_err(|error| format!("代理地址无效: {error}"))?;
            if !config.no_proxy.trim().is_empty() {
                proxy = proxy.no_proxy(reqwest::NoProxy::from_string(&config.no_proxy));
            }
            builder = builder.proxy(proxy);
        }
        builder.build().map_err(|error| error.to_string())
    }

    fn configure(&self, enabled: bool, url: String, no_proxy: String) -> Result<(), String> {
        let config = if enabled {
            reqwest::Proxy::all(url.trim()).map_err(|error| format!("代理地址无效: {error}"))?;
            Some(ProxyConfig {
                url: url.trim().to_owned(),
                no_proxy,
            })
        } else {
            None
        };
        *self
            .proxy
            .write()
            .map_err(|_| "HTTP proxy state lock is poisoned".to_string())? = config;
        Ok(())
    }
}

#[tauri::command]
pub fn set_http_proxy(
    state: tauri::State<'_, NetworkState>,
    enabled: bool,
    url: String,
    no_proxy: String,
) -> Result<(), String> {
    state.configure(enabled, url, no_proxy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_proxy_configuration() {
        let state = NetworkState::default();
        assert!(state
            .configure(true, "not a url".into(), String::new())
            .is_err());
        state
            .configure(true, "http://127.0.0.1:7890".into(), "localhost".into())
            .unwrap();
        assert!(state.blocking_client("test").is_ok());
        state
            .configure(false, String::new(), String::new())
            .unwrap();
        assert!(state.blocking_client("test").is_ok());
    }
}
