var amqp = require('amqplib'),
    Q = require('q').

var amqp_read_url = process.env.AMQP_READ_URL;
var amqp_write_url = process.env.AMQP_WRITE_URL;

var write_chan;
var write_init =
  Q(amqp.connect(amqp_write_url))
  .then(function (conn) {
    console.log('write connection up');
    return conn.createChannel();
  })
  .then(function (ch) {
    write_chan = ch;
    // NB: Not worried about the dependency of later reqs on prev ones here, as
    // AMQP serialises requests on the channel.
    // cf https://npmjs.org/package/amqplib
    return Q.all([
      ch.assertQueue('foo'),
      ch.assertExchange('bar'),
      ch.bindQueue('foo', 'bar', 'baz')
    ]);
  });

function handleMessage(message) {
  write_init.then(function() {
    console.log('writing message:');
    console.log(message);
    write_chan.publish('bar', 'baz', message.content);
  });
}

var read_init =
  Q(amqp.connect(amqp_read_url))
  .then(function (conn) {
    console.log('read connection up');
    return conn.createChannel();
  })
  .then(function (ch) {
    chan = ch;
    return Q.all([
      ch.assertQueue('foo'),
      ch.assertExchange('bar'),
      ch.bindQueue('foo', 'bar', 'baz'),
      ch.consume('foo', handleMessage, {noAck: true})
    ]);
  });
