var amqp = require('amqplib'),
    Q = require('q');

var amqp_read_url = process.env.AMQP_READ_URL;
var amqp_read_queue = process.env.AMQP_READ_QUEUE;

var amqp_write_url = process.env.AMQP_WRITE_URL;
var amqp_write_exchange = process.env.AMQP_WRITE_EXCHANGE;
var amqp_write_route_key = process.env.AMQP_WRITE_ROUTE_KEY;
var amqp_write_queue = process.env.AMQP_WRITE_QUEUE;

var write_chan;
var read_chan;

var write_init =
  Q(amqp.connect(amqp_write_url))
  .then(function(conn) {
    console.log('write connection up');
    // Use a confirm channel so we can be sure the publish succeeded.
    return conn.createConfirmChannel();
  })
  .then(function(ch) {
    write_chan = ch;
    // NB: Not worried about the dependency of later reqs on prev ones here, as
    // AMQP serialises requests on the channel.
    // cf https://npmjs.org/package/amqplib
    return Q.all([
      ch.assertQueue(amqp_write_queue),
      ch.assertExchange(amqp_write_exchange),
      ch.bindQueue(amqp_write_queue, amqp_write_exchange, amqp_write_route_key)
    ]);
  });

function handleMessage(message) {
  write_init.then(function() {
    console.log('writing message:');
    console.log(message.content.toString());
    // Because we are using a confirm channel, we wait until we received
    // confirmation of a successful publish before we ack to the source channel.
    // This is safer.
    write_chan.publish(amqp_write_exchange,
        amqp_write_route_key, message.content).then(function() {
      read_chan.ack(message);
    });
  });
}

var read_init =
  Q(amqp.connect(amqp_read_url))
  .then(function(conn) {
    console.log('read connection up');
    return conn.createChannel();
  })
  .then(function(ch) {
    read_chan = ch;
    return Q.all([
      ch.assertQueue(amqp_read_queue),
      ch.consume(amqp_read_queue, handleMessage, {noAck: false})
    ]);
  });
