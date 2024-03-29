// PCRT Asset Scanner - Client/Frontend interaction module
// Triarom Engineering (c) 2022

// This creates another socket.io server for frontend/client instances to connect to.
// Multiple instances are allowed to connect to the client socket, and will recieve broadcasts about system changes.

const server = require('http').createServer();
const io = require('socket.io')(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const events = require("events");

class Client {
  constructor(logger, config) {
    this.logger = logger.child({meta: {"service": "frontend"}});
    this.logger.debug("frontend interface invoked, loading");
    this.config = config;

    // Setup event emitters
    this.emitter = new events.EventEmitter();

    // Start local server
    server.listen(this.config.ports.client_socket)

    // Handle socket.io connection
    io.on('connection', (socket) => {
      this.handle_connection(socket);
      this.broadcast_message("client_connected", {
        "client_id": socket.id
      });
    });
  }

  async handle_connection(client) {
    this.logger.info(`New frontend connection: ${client.id}`);
    this.emitter.emit("client_connected", client);

    client.onAny((message, data) => {
      this.logger.debug(`[frontend msg] ${client.id}: ${message} - data: ${JSON.stringify(data)}`)
    })

    client.on('disconnect', () => {
      this.logger.info(`Frontend ${client.id} disconected.`)
      this.broadcast_message("client_disconnected", {
        "client_id": client.id
      })
      this.emitter.emit("client_disconnected");
    })

    client.on('work_order_update', (wo_changes) => {
      this.logger.debug("Frontend client has requesed work order update: " + wo_changes.toString());
      this.emitter.emit("work_order_update", wo_changes);
    })

    client.on('request_refresh', () => {
      this.logger.debug("Frontend client has requested refresh");
      // Forwards the client so the response can be sent directly.
      this.emitter.emit("refresh_storage", client);
    })

    client.on("apply_action", async (data) => {
      this.logger.debug("Processing action request...");
      // Forward to main handler.
      this.emitter.emit("apply_action", {
        "client": client,
        "data": data
      })
    })

    client.on("get_lockout_info", async (data) => {
      this.logger.debug("Processing lockout info request...");
      // Forward to main handler.
      this.emitter.emit("get_lockout_info", {
        "client": client,
        "data": data
      })
    })

    client.on("lockout_create", async (data) => {
      this.logger.debug("Processing lockout create request...");
      // Forward to main handler.
      this.emitter.emit("lockout_create", {
        "client": client,
        "data": data
      })
    })

    client.on("clear_lockout", async (data) => {
      this.logger.debug("Processing lockout clear request...");
      // Forward to main handler.
      this.emitter.emit("clear_lockout", {
        "client": client,
        "data": data
      })
    })

    client.on("get_daily_report", async (data) => {
      this.logger.debug("Processing daily report request...");
      // Forward to main handler.
      this.emitter.emit("get_daily_report", {
        "client": client,
        "data": data
      })
    })

    client.on("remove_work_order_location", async (data) => {
      this.logger.debug("Processing remove work order location request...");
      // Forward to main handler.
      this.emitter.emit("remove_work_order_location", {
        "client": client,
        "data": data
      })
    })

    // API v3 - frontend-based acks
    client.on("frontend_ack", async (data) => {
      // This event expects a "type" defintion in order to emit the correct response.
      this.logger.debug("Processing frontend ack");
      if (!data.type) {
        this.logger.warn("frontend_ack received without type definition");
        return;
      }

      data.client_id = client.id;

      switch(data.type) {
        case "location_change_ack":
          // A location change notice has been acknolodged by the frontend, this is primarily used by BayLED to clear the fastflash LED.
          this.emitter.emit("location_change_ack", data);
          break;
        case "frontend_modal_close":
          // A modal has been dismissed for any reason.
          this.emitter.emit("frontend_modal_close", data);
          break;
        default:
          this.logger.warn(`Unexpected frontend_ack with ack type ${data.type}`);
          return;
      }
    })
  }

  async broadcast_message(topic, message) {
    // Broadcast message to all connected clients.
    this.logger.debug("Broadcasting message to all clients: " + message.toString());
    io.emit(topic, message);
  }
}

exports.Client = Client;