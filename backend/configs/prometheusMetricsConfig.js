const promClient = require('prom-client');

const reqResMetrics = new promClient.Histogram({
    name:"http_express_req_res_time",
    help:"Tells how much time taken by req and res.",
    labelNames:["method",'route','status_code','first_time_to_byte','last_time_to_byte','content_length'],
    buckets:[1,50,100,200,400,600,800,1000,1500,2000]
})

const totalRequestCounter = new promClient.Counter({
    name:"total_requests",
    help:"Counts total number of requests handelled by server."
})

module.exports = { reqResMetrics, totalRequestCounter }