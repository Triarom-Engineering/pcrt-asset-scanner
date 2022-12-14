// PCRT Scanner - Scanner -> Agent interface
// Triarom Engineering (c) 2022

const server = require('http').createServer();
const io = require('socket.io')(server);

const events = require("events");

class Scanner {
  constructor(logger, config) {
    this.logger = logger.child({"service": "scanner"});
    this.logger.debug("scanner invoked, loading");
    this.config = config;
    this.scanner_connected = false;

    // Create event emitter for this service.
    this.emitter = new events.EventEmitter();

    // Start local server
    server.listen(this.config.ports.scanner_socket)

    // Handle socket.io connection
    io.on('connection', (socket) => {
      this.handle_connection(socket);
    });
  }

  async handle_connection(client) {
    if (this.scanner_connected) {
      // There is already a scanner connected, end the session.
      this.logger.info("scanner socket connection rejected, there is already a scanner connected")
      await client.emit("error", "there is already a scanner connected");
      await client.disconnect();
      return;
    }

    this.logger.info("New scanner agent has connected.")
    this.emitter.emit("scanner_connected");
    this.scanner_connected = true;

    client.on('event', (data) => {
      this.logger.debug("scanner event: " + data);
    })

    client.on('manifest', (data) => {
      this.logger.debug("Scanner manifest recieved");
      this.logger.debug(JSON.stringify(data));
      this.logger.info(`Scanner type ${data.type} connected, version ${data.version}`)
      this.emitter.emit("scanner_info", data);
    })

    client.on('barcode', async (data) => {
      this.logger.debug("scanner barcode: " + data);
      if (data.startsWith("PCRT_SCAN_")) {
        this.logger.info("recieved system command: " + data);
        return this.emitter.emit("system_command", data.replace("PCRT_SCAN_", "").trim());
      }
      this.emitter.emit("barcode", data);

      await client.emit("ack", data);
    })

    client.on('fault', async () => {
      this.logger.warn(`Fault reported by Scanner, alerting clients.`);
      await this.emitter.emit("scanner_faulted");
    })

    client.on('fault_clear', async () => {
      this.logger.info("Scanner has cleared the fault.");
      await this.emitter.emit("scanneR_fault_clear");
    })

    client.on('disconnect', () => {
      this.logger.warn("scanner agent has gone away.")
      this.scanner_connected = false;
      this.emitter.emit("scanner_disconnected");
    })
  }
}

exports.Scanner = Scanner;