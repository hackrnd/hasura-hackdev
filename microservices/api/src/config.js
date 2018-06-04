let notify = {
    url: 'https://notify.<cluster-name>.hasura-app.io/v1/send/email',
    token: 'xxxxxxxxxx'
}

if (process.env.ENVIRONMENT === 'dev') {
  notify.url = 'http://127.0.0.1:6432/v1/send/email';
  notify.token = 'xxxxxxxxxx';
}

module.exports = {
  notify
};
