// PCRT-Scan - HTML Frontend
// Triarom Engineering (c) 2022

let socket;

const config = {
  "server": "http://localhost:3500",
  "api_vers": 3.0,
}

const state_icons = {
  "storage": "bi bi-box-fill",
  "on_bench": "bi bi-screwdriver",
  "pending_cust_response": "bi bi-person-fill",
  "complete": "bi bi-check-circle-fill",
  "collected": "bi bi-check-circle-fill",
  "data_transfer": "bi bi-device-hdd-fill",
  "awaiting_parts": "bi bi-tools",
  "awaiting_parts_customer": "bi bi-tools",
  "peer_review_pending": "bi bi-people-fill"
}

const state_colours = {
  "storage": "btn-primary",
  "on_bench": "btn-info",
  "pending_cust_response": "btn-warning",
  "complete": "btn-success",
  "data_transfer": "btn-warning",
  "awaiting_parts": "btn-danger",
  "awaiting_parts_customer": "btn-danger",
  "peer_review_pending": "btn-danger"
}

let benches = [];

const audio_success = new Audio("/static/success.mp3");
const audio_yass = new Audio("/static/yass.mp3");
const audio_error = new Audio("/static/error.mp3");

let last_scan = null;

const slice_array = (arr, chunkSize) => {
  // Derived from https://stackabuse.com/how-to-split-an-array-into-even-chunks-in-javascript/
  let res = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
      const chunk = arr.slice(i, i + chunkSize);
      res.push(chunk);
  }
  return res;
}

class WelcomeModal {
  constructor() {
    this.modal = new bootstrap.Modal("#welcome-modal")
    this.version_info = document.getElementById("version-info");
  }

  async show(api_version, scan_count) {
    if (scan_count) {
      this.version_info.innerText = `API Version: ${api_version} | Total Scans: ${scan_count}`;
    } else {
      this.version_info.innerText = `API Version: ${api_version}`;
    }
    this.modal.show();
  }

  async hide() {
    this.modal.hide();
  }
}

class RepairReportModal {
  constructor() {
    this.modalDiv = document.getElementById("repair-report-modal");
    this.modal = new bootstrap.Modal("#repair-report-modal")
  }

  async show() {
    this.modal.show();
  }

  async hide() {
    this.modal.hide();
  }
}

class LoadingModal {
  constructor() {
    this.message = "Thinking about it...";
    this.message_box = document.getElementById("loading-modal-text");
    this.message_box.innerText = this.message;
    this.modal = new bootstrap.Modal("#loading-modal");
    this.visible = false;
  }

  async show(message = "Twiddling thumbs..") {
    this.message_box.innerText = message;
    this.visible = true;
    await this.modal.show({'backdrop': 'static', 'keyboard': false})
  };

  async update(message) {
    // Replace text in the loading modal.
    if (!this.visible) {
      this.show(message)
    } else {
      this.message_box.innerText = message;
    };
  }

  async hide() {
    // Incredibly temporary fix for race condition hiding this modal.
    setTimeout(async () => {
      await this.modal.hide()
      this.visible = false;
    }, 500)
  };
}

class InfoModal {
  constructor() {
    this.title = document.getElementById("info-modal-title");
    this.body = document.getElementById("info-modal-body");
    this.modal = new bootstrap.Modal("#info-modal");
    this.visible = false;
  }

  async show(title, body) {
    this.title.innerHTML = title;
    this.body.innerHTML = body;
    await this.modal.show()
    this.visible = true;
  };

  async hide() {
    if (this.visible) await this.modal.hide()
    this.visible = false;
  };
}

class AssetLocationModal {
  constructor() {
    this.title = document.getElementById("asset-location-modal-title");
    this.body = document.getElementById("asset-location-modal-body");
    this.status = document.getElementById("asset-location-modal-status");
    this.bay = document.getElementById("asset-location-modal-bay");
    this.text = document.getElementById("asset-location-modal-text");
    this.modalDiv = document.getElementById("asset-location-modal");
    this.modal = new bootstrap.Modal("#asset-location-modal");
    this.visible = false;
  }

  async show(status, bay) {
    this.bay.innerText = bay;
    if (status == "new") {
      this.status.innerText = "NEW ASSET",
      this.text.innerText = "This asset has been assigned a new bay that was previously empty. Please take it to this bay now."
    } else if (status == "moved") {
      this.status.innerText = "NEW BAY ASSIGNED",
      this.text.innerText = "This asset has been moved to a new bay. Please place it in the new bay shown above, including any accessories still left in the original bay."
    } else if (status == "return") {
      this.status.innerText = "RETURN TO",
      this.text.innerText = "This asset already has a bay that is still valid for the action performed, please return it to the bay displayed above."
    } else if (status == "customer") {
      this.status.innerText = "RETURN TO",
      this.bay.innerText = "CUSTOMER"
      this.text.innerText = "Return this device to the customer, and advise them they will recieve a message when the parts arrive. If you'd like to free the bay, unset it using PCRT."
    } else {
      this.status.innerText = "",
      this.text.innerText = "I'm not really sure what's happened here, take the asset to the bay shown above."
    }
    await this.modal.show()
    this.visible = true;
  };

  async hide() {
    if (this.visible) await this.modal.hide()
    this.visible = false;
  };
}

class DailyReportModal {
  constructor() {
    this.date = document.getElementById("daily-report-modal-date");
    this.scans = document.getElementById("daily-report-modal-scans");
    this.actions_applied = document.getElementById("daily-report-modal-actions");
    this.actions = document.getElementById("daily-report-modal-actions-list");
    this.lockouts_created = document.getElementById("daily-report-modal-lockouts-created");
    this.lockouts_cleared = document.getElementById("daily-report-modal-lockouts-cleared");
    this.modal = new bootstrap.Modal("#daily-report-modal");
    this.visible = false;
  }

  async show(data) {
    this.date.innerHTML = `Day Commencing: <b>${new Date().toLocaleDateString()}</b>`
    this.scans.innerText = data.scans;
    this.actions_applied.innerText = data.action_count;
    this.actions.innerHTML = "";
    for (let action in data.actions) {
      this.actions.innerHTML += `<li><b>${action}: </b>${data.actions[action]}</li>`
    }
    this.lockouts_created.innerText = data.lockouts_created;
    this.lockouts_cleared.innerText = data.lockouts_cleared;
    await this.modal.show()
    this.visible = true;
  };

  async hide() {
    if (this.visible) await this.modal.hide()
    this.visible = false;
  };
}

class ErrorModal {
  constructor() {
    this.icon = document.getElementById("error-modal-icon");
    this.heading = document.getElementById("error-modal-heading");
    this.text = document.getElementById("error-modal-text");
    this.modal = new bootstrap.Modal("#error-modal");
    this.visible = false;
  }

  async show(icon, heading, text) {
    this.icon.className = icon || "bi bi-exclamation-triangle-fill";
    this.heading.innerHTML = heading;
    this.text.innerHTML = text;
    await this.modal.show({'backdrop': 'static', 'keyboard': false})
    this.visible = true;
  };

  async hide() {
    if (this.visible) await this.modal.hide()
    this.visible = false;
  };
}

class ToastAlert {
  constructor() {
    this.toast_title = document.getElementById("toast-alert-title");
    this.toast_small = document.getElementById("toast-alert-small");
    this.toast_body = document.getElementById("toast-alert-body");
    this.toast = new bootstrap.Toast("#toast-alert");
  }

  async show(title = "Toast", content = "Toast message", small = "") {
    this.toast_title.innerText = title;
    this.toast_body.innerText = content;
    this.toast_small.innerText = small;
    await this.toast.show({});
  }

  async hide() {await this.toast.hide()};
}

class LockoutCreateModal {
  constructor() {
    this.text = document.getElementById("lockout-create-modal-text");
    this.buttons = document.getElementById("lockout-create-modal-actions");
    this.modal = new bootstrap.Modal("#lockout-create-modal");
    this.visible = false;
  }

  async show(lockout, bay) {
    this.text.innerHTML = `No lockouts have been assigned to ${bay}. Only create a lockout as a temporary measure, for example, if you are unsure why an asset is in a specific bay. Select your name below to create a lockout.`;

    // Create engineer buttons
    this.buttons.innerHTML = "";
    console.dir(lockout)
    for (let engineer of lockout.engineers) {
      let btn = document.createElement("button");
      btn.className = "btn btn-block btn-primary";
      btn.innerText = engineer;
      btn.addEventListener("click", () => {
        this.hide();
        socket.emit("lockout_create", {slid: bay, engineer: engineer});
      });

      this.buttons.appendChild(btn);

    }
    await this.modal.show();
    this.visible = true;
  }
  async hide() {
    if (this.visible) await this.modal.hide();
    this.visible = false;
  }
}

class LockoutViewModal {
  constructor() {
    this.text = document.getElementById("lockout-view-modal-text");
    this.buttons = document.getElementById("lockout-view-modal-actions");
    this.modal = new bootstrap.Modal("#lockout-view-modal");
    this.visible = false;
  }

  async show(lockout) {
    this.text.innerHTML = `Lockout ${lockout.id} is assigned to ${lockout.engineer} and was created at ${new Date(lockout.timestamp).toLocaleDateString()}.`;
    this.buttons.innerHTML = `<button type="button" class="btn btn-primary" onclick="lockout_release(${lockout.id})">Release Lockout</button>`;
    await this.modal.show();
    this.visible = true;
  }
  async hide() {
    if (this.visible) await this.modal.hide();
    this.visible = false;
  }
}

class ScanModal {
  constructor() {
    this.title = document.getElementById("scan-modal-label");
    this.items = {
      "owner": document.getElementById("scan-modal-owner"),
      "status": document.getElementById("scan-modal-current-status"),
      "problem": document.getElementById("scan-modal-problem"),
      "location": document.getElementById("scan-modal-location"),
      "check_in_date": document.getElementById("scan-modal-check-in-date"),
    }
    this.buttons = document.getElementById("scan-modal-actions");
    this.modalDiv = document.getElementById("scan-modal");
    this.modal = new bootstrap.Modal("#scan-modal");
    this.notes = document.getElementById("scan-modal-notes");
    this.visible = false;
  }

  async show(scan_data) {
    const work_order = scan_data.work_order;
    const buttons = gen_action_buttons(scan_data.work_order.id, scan_data.options.states || [])

    const open_date = new Date(work_order.open_date);
    this.title.innerHTML = `<i class="bi bi-qr-code"></i> Scanned Work Order - ${work_order.customer.name} (${work_order.customer.id})`;
    this.items.owner.innerHTML = `Owner: <i class="bi bi-person-fill"></i> ${work_order.customer.name} <span class="badge bg-secondary">${work_order.customer.company}</span>`;
    this.items.status.innerHTML = `Status: <span class="badge bg-primary"><i class="${state_icons[work_order.status.pcrt_scan_state.name]}"></i> ${work_order.status.name}</span>`;
    this.items.check_in_date.innerHTML = `Check-in Date: <i class="bi bi-calendar-date"></i> ${open_date.toLocaleDateString()} (${moment(open_date).fromNow()})`;
    this.items.problem.innerHTML = `${work_order.problem}`;

    if (scan_data.work_order.location != undefined) {
      this.items.location.innerHTML = `Asset Location: <b>${scan_data.work_order.location.name}</b> <a href='#' onclick="release_location('${scan_data.work_order.id}'); return true">Release</a>`;
    } else {
      this.items.location.innerHTML = `Asset Location: <b>Not yet checked-in</b>`;
    }

    this.buttons.innerHTML = buttons;

    if (work_order.notes) {
      this.notes.innerHTML = gen_wo_notes(work_order.notes);
    } else {
      this.notes.innerText = "No Engineering Notes Logged";
    }

    this.modal.show({'backdrop': 'static', 'keyboard': false});
    this.visible = true;
  }

  async hide() {
    if (this.visible) await this.modal.hide()
    this.visible = false;
  };
}

const release_location = (wo_id) => {
  socket.emit("remove_work_order_location", wo_id);
  scan_modal.hide();

  const toast = new ToastAlert();
  toast.show("Location Released", "The location has been released. Wait.", "success");
}

const request_refresh = async () => {
  // Request a new storage status poll
  const toast = new ToastAlert();
  document.getElementById("grid").innerHTML = "";

  loading_modal.show("Refreshing Grid Data");
  socket.emit("request_refresh");
  await toast.show("Refresh Requested", "Refreshing storage view...", "Pending")
}

const gen_wo_notes = (notes) => {
  if (notes.length == 0) return "No Engineering Notes Logged";

  let html = "<div class='row g-2 pt-2'>";
  for (let note of notes) {
    const date = new Date(note.timestamp);
    html += `<div class="col-6">
      <div class="card">
        <div class="card-body bg-dark text-light">
          <h5 class="card-title">${note.author} - ${date.toLocaleDateString()} ${date.toLocaleTimeString()} <h6 class='text-muted'>(${moment(date).fromNow()})</h6></h5>
          <p class="card-text">${note.content}</p>
        </div>
      </div>
    </div>`;
  }
  return html += "</div>";
}

const set_repair_report_modal_data = (work_order, completed_action_id) => {
  const button = document.getElementById("repair-report-collected-btn");
  const description = document.getElementById("repair-report-description");
  const customer_name = document.getElementById("repair-report-customer-name");
  const woid = document.getElementById("repair-report-woid");
  const device = document.getElementById("repair-report-device");
  const arrival = document.getElementById("repair-report-arrival");
  const labour = document.getElementById("repair-report-labour");
  const cost = document.getElementById("repair-report-cost");
  const customer_notes = document.getElementById("repair-report-customer-notes");
  const internal_notes = document.getElementById("repair-report-internal-notes");

  button.onclick = () => {perform_action(completed_action_id, work_order.id)}
  description.innerText = work_order.problem;
  customer_name.innerText = work_order.customer.name;
  device.innerHTML = `<i class="bi bi-laptop"></i> Device: <b>${work_order.customer.device}</b>`
  woid.innerText = work_order.id;
  arrival.innerHTML = `<i class="bi bi-calendar-check"></i> Arrival Date: <b>${new Date(work_order.open_date).toLocaleDateString()}</b>`
  cost.innerText = "£" + work_order.tasks.cost || "NO REPORT";


  // Add labour entries to grid
  labour.innerHTML = "";
  for (let entry of work_order.tasks.tasks) {
    labour.innerHTML += `
      <li class="list-group-item bg-dark text-light">
      <div class="row">
        <div class="col col-9">
          <p class="card-text">${entry.name}</p>
        </div>
        <div class="col col-3">
          <p class="card-text text-end"><b>£${entry.cost}</b></p>
        </div>
      </div>
    </li>`;
  }

  // Add customer notes
  customer_notes.innerHTML = "";
  if (work_order.notes) {
    for (let note of work_order.notes) {
      customer_notes.innerHTML += `
        <li class="list-group-item bg-dark text-light">
        <div class="row">
          <div class="col col-9">
            <p class="card-text">${note.content}</p>
          </div>
          <div class="col col-3">
            <p class="card-text text-end"><b><i class="bi bi-person-fill"></i> ${note.author}</b></p>
          </div>
        </div>
      </li>`
    }
  }

  // Add internal notes
  internal_notes.innerHTML = "";
  if (work_order.internal_notes) {
    for (let note of work_order.internal_notes) {
      internal_notes.innerHTML += `
        <li class="list-group-item bg-dark text-light">
        <div class="row">
          <div class="col col-9">
            <p class="card-text">${note.content}</p>
          </div>
          <div class="col col-3">
            <p class="card-text text-end"><b><i class="bi bi-person-fill"></i> ${note.author}</b></p>
          </div>
        </div>
      </li>`
    }
  }
}

const gen_action_buttons = (woid, actions) => {
  // Generate buttons
  let html = "<div class='row'>";

  for (let action in actions) {
    action = actions[action];

    // Resolve icon for action
    const icon = state_icons[action['pcrt_scan_state']['name']] || "bi bi-app";

    // Resolve button colour to class
    const colour = state_colours[action['pcrt_scan_state']['name']] || "btn-primary"

    // Resolve button name - prefer alias from PCRT-Scan.
    const name = action['pcrt_scan_state']['alias'] || action['name']

    html += "<div class='col'>"
    html += '<div class="btn-group" style="width:100%">'
    html += `<button type="button" onclick="perform_action('${action['pcrt_scan_state']['name']}', ${woid}); return true;" class="btn btn-block ${colour}"><i class="${icon}"></i> ${name}</button>`
    html += "</div></div>"
  }

  html += "</div>";
  return html;
}

const prepare_lockout = async (slid) => {
  // Send a lockout_info request to the server#
  await toast.show("Requesting lockout Information", `Fetching data on ${slid}`, slid);
  socket.emit("get_lockout_info", {"slid": slid});
}

const bay_select = async (slid) => {
  // Select a bay to view
  await info.show("Bay Information", "Coming soon.");
}

const request_daily_report = async () => {
  // Request a new storage status poll
  socket.emit("get_daily_report");
}

const lockout_release = async (lockout_id) => {
  // Trigger a server lockout release
  await toast.show("Releasing Lockout", `Releasing lockout ${lockout_id}`, lockout_id);
  view_lockout_modal.hide();
  socket.emit("clear_lockout", {"id": lockout_id});
  audio_success.play();
}

const hide_clashes = async () => {
  document.getElementById("clash-alert").style.display = "none";
}

const show_clashes = async (location_name, work_orders) => {
  // Display a clash alert if one is caught.
  const alert_box = document.getElementById("clash-alert");
  const alert_text = document.getElementById("clash-alert-text");

  let text = ` Work order clash in ${location_name} - between: `;

  for (let wo in work_orders) {
    wo = work_orders[wo];
    if (wo.type == "work_order") {
      text += `${wo.payload.customer.name} (${wo.payload.id}) `
    } else if (wo.type == "lockout") {
      text += `lockout (${wo.payload.id}) `
    } else continue;
  }

  error_modal.show("bi bi-exclamation-circle-fill", "Storage Clash Detected", `Storage bay <b>${location_name}</b> has two work orders/lockouts. Resolve this immediately!`)
  audio_error.play();

  alert_text.innerText = text + " RESOLVE ASAP!";
  alert_box.style.display = "block";
}

// const action_modal = new LoadingModal();

const perform_action = async (action_id, woid) => {
  const toast = new ToastAlert();
  console.log(`perform action ${action_id} on w/o ${woid}`)
  repair_report_modal.hide();
  scan_modal.hide();

  await toast.show("Performing action", `Applying ${action_id} on work order ${woid}`, woid);
  // action_modal.show("Applying changes");

  socket.emit("apply_action", {
    "action_id": action_id,
    "work_order": woid
  })
}

const loading_modal = new LoadingModal();
const toast = new ToastAlert();
const info = new InfoModal();
const error_modal = new ErrorModal();
const scan_modal = new ScanModal();
const create_lockout_modal = new LockoutCreateModal();
const view_lockout_modal = new LockoutViewModal();
const asset_location_modal = new AssetLocationModal();
const daily_report_modal = new DailyReportModal();
const welcome_modal = new WelcomeModal();
const repair_report_modal = new RepairReportModal();

const main = async () => {
  const status_text = document.getElementById("scan-status");

  socket = await io(config.server);

  document.body.addEventListener("hidden.bs.modal", async (modal) => {
    // Capture all modal closes, and broadcast "frontend_modal_close" frontend_ack.

    // Only handle "interactive" modals, check the modal ID is in the following array.
    const monitored_modals = [
      "scan-modal",
      "asset-location-modal",
      "repair-report-modal"
    ]

    if (!monitored_modals.includes(modal.target.id)) return;

    socket.emit("frontend_ack", {
      "type": "frontend_modal_close",
      "modal": modal.target.id
    })
  })

  socket.on('connect', async () => {
    console.log('Connected to server!');
    toast.show("Connected", "Connected to PCRT-Scan backend", "Just Now");
    await loading_modal.hide();
  })

  socket.on('client_connected', async (data) => {
    toast.show("New Client", `${data.client_id} has connected.`, "Just Now");
  })

  socket.on('client_disconnected', async () => {
    toast.show("Client Disconnected", `${data.client_id} has disconnected.`, "Just Now");
  })

  socket.on('hello', async (data) => {
    await loading_modal.hide();
    toast.show("Server Hello", "Got hello from server!", "Just Now");

    // Confirm API version
    if (data.api_version != config.api_vers) {
      error_modal.show("bi bi-exclamation-circle-fill", "API Version Mismatch",
      `The server is running an incompatible API version. Please upgrade/refresh this client, or the server. Expected API: ${config.api_vers}, got: ${data.api_version}`)
      audio_error.play();
      socket.close();
      return;
    }

    document.getElementById("navbar").style.display = "block";
    document.getElementById("bay-legend").style.display = "block";

    // Check scanner status
    if (!data.scanner_ready) {
      error_modal.show("bi bi-upc-scan", "Scanner Disconnected", "Please check the services and USB cables to ensure the scanner is connected.")
    } else {
      status_text.innerText = "Ready to Scan";
      status_text.className = "text-success";
    }

    // Set client ID text
    document.getElementById("client-id-text").innerText = data.client_id || "";

    welcome_modal.show(data['api_version'], data['scan_count'] || undefined);

    // Request benches
    socket.emit("get_benches");
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server!');
    toast.show("Disconnected", "Lost connection from local server.", "Just Now")
    // loading_modal.show("Reconnecting to server...");

    document.getElementById("navbar").style.display = "none";
    document.getElementById("bay-legend").style.display = "none";
    document.getElementById("grid").innerHTML = "";

    document.getElementById("grid-data-pending").style.display = "block";
    audio_error.play();
  })

  socket.on('scanner_status', async (status) => {
    console.log("Scanner status:", status);

    if (status.status == "disconnected") {
      error_modal.show("bi bi-upc-scan", "Scanner Disconnected", "Please check the services and USB cables to ensure the scanner is connected.")
      status_text.innerText = "Not Ready";
      status_text.className = "text-danger";
      audio_error.play();
    } else if (status.status == "connected") {
      error_modal.hide();
      audio_success.play();
      if (status.type) {
        status_text.innerText = `Ready to Scan - ${status.type} (v ${status.version})`;
      } else {
        status_text.innerText = "Ready to Scan";
      }
      status_text.className = "text-success";
    } else if (status.status == "faulted") {
      status_text.innerText = "Not Ready - FAULTED!";
      status_text.className = "text-warning";
      await error_modal.show("bi bi-upc-scan", "Scanner Faulted!", status.message)
    }
  })

  socket.on('scan', async (data) => {
    console.log("Scan data:", data);
    error_modal.hide();
    loading_modal.hide();
    last_scan = new Date();

    if (data.work_order.status.pcrt_scan_state.name == "complete") {
      // Work order is marked complete, show the repair report
      if (data.work_order.tasks == undefined || data.work_order.tasks.length == 0) {
        // No tasks, show an error.
        await error_modal.show("bi bi-exclamation-circle-fill", "Repair Report not Complete!", "No repair report has been added to this work order. Please add one before checking devices out.")
        return;
      }
      set_repair_report_modal_data(data.work_order, "collected");
      repair_report_modal.show();
      return;
    }

    scan_modal.show(data);
  })

  socket.on('lockout_info', async (data) => {
    console.log("Lockout info:", data);
    error_modal.hide();
    loading_modal.hide();

    if (data.lockout) {
      // Lockout in place, show info modal
      view_lockout_modal.show(data.lockout);
    } else {
      // No lockout in place, show create lockout modal.
      create_lockout_modal.show(data, data.slid);
    }
  })

  socket.on('ack_action', async (data) => {
    // Server has acknolodged an action, close the modal.
    console.log("Got server ack for action, ack data:");
    console.dir(data)

    // Show alerts if the server sent any.
    if (data['alert'] != undefined) {
      await info.show("System Alert", data['alert']);
    }

    if (data == "ack_elsewhere") {
      // Hide any user-interaction modals if the action was acknolodged elsewhere, i.e., by aonther frontend.
      setTimeout(async () => {
        // await loading_modal.hide();
        await asset_location_modal.hide();
        await repair_report_modal.hide();
        await scan_modal.hide();
      }, 300)

      // No further processing is necessary.
      return;
    }

    // Don't continue if the location info modal isn't required.
    // setTimeout(async () => {
    //   // Very temporary fix for a race condition
    //   await loading_modal.hide();
    // }, 300)

    // Play correct audio for action
    audio_success.play();

    if (!data['location_info_required']) return;

    if (data['location_changed']) {
      // A new location has been selected, inform the user they must use this location.
      // Check if this state has is_on_site set to false, then display "customer" instead of "moved"
      if (!data['action'].is_on_site) {
        await asset_location_modal.show("customer", null)
      } else {
        await asset_location_modal.show("moved", data.location.name)
      }
      //await info.show("Location Chosen Automatically", `Please place this device in <b>${data.location.name}</b> <br><br><i class="bi bi-info-circle-fill"></i> If this bay is not available, please manually update it in PCRT and click refresh on the dashboard.<br><br><i class="bi bi-info-circle-fill"></i> <b>Please Note: </b> If this device has been moved between states, a new location may have been chosen. Please pay attention to this!`);
    } else {
      await asset_location_modal.show("return", data.location.name)
      //await info.show("Return Asset to Location", `Please return this asset to it's storage bay <b>${data.location.name}.</b>`)
    }
  })

  socket.on('daily_report', async (data) => {
    console.log("Got daily report:", data);
    error_modal.hide();
    loading_modal.hide();
    daily_report_modal.show(data);
  })

  socket.on('storage_state', async (storage_bays) => {
    // Handle new storage bay information. This is either requested or sent on an interval.
    const dom_container = document.getElementById("grid");
    const dom_container_pending = document.getElementById("grid-data-pending");
    dom_container_pending.style.display = "block";
    await hide_clashes();

    // Split storage bays into sections (by the storage_type)
    // For example, the A prefixed bays in our installation are 'work-in-progress' this is show the bays can be split correctly.
    // TODO: This will need refactoring to make the system portable - as will a lot of the project.
    let types = {};

    for (const bay_name in storage_bays) {
      const bay = storage_bays[bay_name];

      if (!types.hasOwnProperty(bay['location_type'])) {
        // Create a new location type
        types[bay['location_type']] = [];
      }

      types[bay['location_type']].push(bay);
    }

    // Process each of the storage bay types into an array for gridgen
    let entries = [];

    for (const type_id in types) {
      const type = types[type_id];
      let type_entries = [];

      if (type.length > 5) {
        // MAGIC NUMBERS HERE.
        // There are a large number of bays of this type, so we'll split them across multiple rows.
        type_entries = slice_array(type, 4)
      } else {
        type_entries = [type]
      }

      // Format this style of array into that expected by gridgen.
      for (let row in type_entries) {
        row = type_entries[row];
        let entry_row = []

        for (let col in row) {
          col = row[col];
          let entry_col = {
            "title": col['name'],
            "slid": col['id']
          }

          console.dir(col)
          if (col.hasOwnProperty('work_order')) {
            if (col['work_order']['type'] == "work_order") {
              col['work_order'] = col['work_order']['payload'] // Extract payload from work_order (v2 api compat)
              const open_date = new Date(col['work_order']['open_date']);
              entry_col['title'] = `${col['name']} (${col['work_order']['id']}) - ${moment(open_date).fromNow()}`
              // Bay is in use
              console.log(col['work_order']['status']['id'])
              switch(col['work_order']['status']['id']) {
                case 1:
                  // In storage
                  entry_col['status'] = "wip";
                  break;
                case 2:
                  // On the bench
                  entry_col['status'] = "bench";
                  break;
                case 4:
                  // Complete
                  entry_col['status'] = "complete";
                  break;
                case 3:
                  // Waiting for customer
                  entry_col['status'] = "customer";
                  break;
                case 101:
                  // Waiting for parts
                  entry_col['status'] = "parts";
                  break;
                case 205:
                  // Waiting for parts - with customer
                  entry_col['status'] = "parts_customer";
                  break;
                case 102:
                  // Peer Review Pending
                  entry_col['status'] = "peer_review";
                  break;
                default:
                  // Any other system status
                  entry_col['status'] = "bench";
                  break;
              }

              entry_col['bay_status'] = col['work_order']['customer']['name'];
              entry_col['bay_status_secondary'] = col['work_order']['customer']['device'] || "";
            } else if (col['work_order']['type'] == "lockout") {
              entry_col['title'] = `${col['name']}`
              entry_col['status'] = "lockout";
              entry_col['bay_status'] = `Bay locked by ${col['work_order']['payload']['engineer']}`;
            }

          } else if (col.hasOwnProperty('error')) {
            if (col['error'] === "clash") {
              entry_col['title'] = col['name'];
              entry_col['status'] = "error";
              entry_col['bay_status'] = "Clashed Work Order!";
              entry_col['high_priority'] = true;
              await show_clashes(col['name'], col['clashing_work_orders'])
            } else {
              entry_col['title'] = col['name'];
              entry_col['status'] = "error"
              entry_col['bay_status'] = `Unavailable: ${col['error']}`
            }

          } else {
            entry_col['status'] = "available";
            entry_col['bay_status'] = "Available."
          }

          entry_row.push(entry_col)
        }

        entries.push(entry_row)
      }
    }

    dom_container.innerHTML = gen_grid(entries)
    dom_container_pending.style.display = "none";
    loading_modal.hide();
  })

  socket.on('server_error', async (error) => {
    loading_modal.hide();
    scan_modal.hide();

    error_modal.show("bi bi-exclamation-triangle-fill", error.error, error.message);
    audio_error.play();
  })

  socket.on('info', async (info) => {
    await toast.show("Server Info", info.message, info.type);
  })

  socket.on('busy', async (message) => {
    // Server is busy performing a task, show the loading modal.
    if (message.startsWith("considering_location_")) {
      // Get the scan location after the final _
      const location = message.split("_").pop();
      console.log(location)
      await loading_modal.update(`Considering new Bay: ${location}`);
      return;
    } 

    switch (message) {
      case "fetching":
        loading_modal.update("Fetching Data");
        break;
      case "applying_action":
        loading_modal.update("Applying Changes");
        break;
      case "new_location":
        loading_modal.update("Choosing a new Location");
        break;
      case "updating_pcrt":
        loading_modal.update("Saving Changes");
        break;
      default:
        loading_modal.update("Processing");
        break;
    }
  })

  socket.on("benches", async (data) => {
    benches = data;
  })

  // Send refresh message to server every 5 minutes
  // TODO: potentially move this to server logic, to stop multiple clients from requesting a refresh at once.
  setInterval(async () => {
    await socket.emit("request_refresh")
  }, 5 * 60 * 1000)

  // Update sys-time every second
  setInterval(async () => {
    const time_dom = document.getElementById("sys-time");
    const last_scan_dom = document.getElementById("last-scan-time");
    time_dom.innerHTML = moment().format("DD/MM/YY | HH:mm:ss");
    if (last_scan) last_scan_dom.innerHTML = `Last Scan: ${moment(last_scan).fromNow()}`;
  }
  , 1000);
}

main();