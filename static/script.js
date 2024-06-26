"use strict"
/**
 * TypeScript code for OCRA, the OCR Assistant.
 *
 * CODE STYLE REMARKS:
 * >Aimed code comment style: https://tsdoc.org/
 * >Global DOM-related variables are prefixes with "dom_"
 * >Global non-DOM variables are prefixed with "g_"
 *
 * ORDER OF SOURCE CODE SECTIONS:
 * 1. Custom types section
 * 2. Global variables section
 * 3. Server communication handlers & functions section
 * 4. Input event listeners functions section
 * 5. Canvas logic section
 * 6. Textarea functions section
 * 7. Startup routine section
 */

/* # 1. CUSTOM TYPES SECTION # */
/**
 * Represents a basic image configuration.
 * @typedef {Object} BaseImageConfig
 * @property {string} x_zoom - Current X axis zoom  in %.
 * @property {number} y_zoom - Current Y axis zoom in %.
 * @property {number} rotation - Current image rotation in degrees (°).
 * @property {boolean} is_binarized - Indicates whether or not the current page is black&white-binarized.
 * @property {number} binarization_threshold - If is_binarized is true, indicates the black&white binarization threshold.
 * @property {number} dpi -  The current page image's DPI. Changes of it also affect the coordinate sytem.
 */

/**
 * Represents a user-drawn rectangle for marking an OCR area.
 * @typedef {Object} Rect
 * @property {number} x - The X coordinate of the Rect's upper left corner.
 * @property {number} y - The Y coordinate of the Rect's upper left corner.
 * @property {number} w - The Rect's width.
 * @property {number} h - The Rect's height.
 * @property {string} language_state - Either '1', '2' or '1_and_2', used according to the current languages TODO: Change to enum.
 * @property {boolean} temp - Is true if the Rect is currently drawn (mouse down), false as soon as the mouse is up.
 */


/* # 2. GLOBAL VARIABLES SECTION #
   After the Socket.IO initialization, the variables are sorted after appearance in OCRA's GUI,
   starting from the top left in left-to-right direction.
*/
/* ## Socket.IO main variable ## */
const socket = io()

/* ## Tesseract configuration DOM variables ## */
/** @type {HTMLInputElement} */
const dom_set_tesseract_path = document.querySelector("#set_tesseract_path")
/** @type {Element} */
const dom_tesseract_path = document.querySelector("#tesseract_path")
/** @type {HTMLInputElement} */
const dom_tesseract_arguments = document.querySelector("#tesseract_arguments")
/** @type {HTMLInputElement} */
const dom_tesseract_language_1 = document.querySelector("#tesseract_language_1")
/** @type {HTMLInputElement} */
const dom_tesseract_language_2 = document.querySelector("#tesseract_language_2")

/* ## Open PDF/project DOM variables ## */
/** @type {HTMLInputElement} */
const dom_open_project_folder = document.querySelector("#open_project_folder")
/** @type {HTMLInputElement} */
const dom_open_new_pdf = document.querySelector("#open_new_pdf")

/* ## Viewed page control variables ## */
/** @type {HTMLInputElement} */
const dom_page_down = document.querySelector("#page_down")
/** @type {HTMLInputElement} */
const dom_current_page = document.querySelector("#current_page")
/** @type {Element} */
const dom_page_number = document.querySelector("#page_number")
/** @type {HTMLInputElement} */
const dom_page_goto = document.querySelector("#page_goto")
/** @type {HTMLInputElement} */
const dom_page_up = document.querySelector("#page_up")
/** @type {number} */
var g_current_page = 0

/* ## Run OCR DOM variables ## */
/** @type {HTMLInputElement} */
const dom_ocr_overwrite = document.querySelector("#ocr_overwrite")
/** @type {HTMLInputElement} */
const dom_ocr_append = document.querySelector("#ocr_append")

/* ## Clear rects DOM variable ## */
/** @type {HTMLInputElement} */
const dom_clear_all_rects = document.querySelector("#clear_all_rects")

/* ## X zoom variables ## */
/** @type {HTMLInputElement} */
const dom_x_zoom_input = document.querySelector("#x_zoom_range")
/** @type {HTMLInputElement} */
const dom_x_zoom_value = document.querySelector("#x_zoom_value")
/** @type {number} */
var g_x_zoom_factor = Number(dom_x_zoom_input.value) / 100

/* ## Y zoom variables ## */
/** @type {HTMLInputElement} */
const dom_y_zoom_input = document.querySelector("#y_zoom_range")
/** @type {HTMLInputElement} */
const dom_y_zoom_value = document.querySelector("#y_zoom_value")
/** @type {number} */
var g_y_zoom_factor = Number(dom_y_zoom_input.value) / 100

/* ## Text area DOM variables ## */
/** @type {HTMLInputElement} */
const dom_text_area = document.querySelector("#text_area")

/* ## Canvas and canvas logic variables ## */
// -> Canvas DOM variables
/** @type {HTMLCanvasElement} */
const dom_canvas = document.getElementById('viewport')
/** @type {CanvasRenderingContext2D} */
const dom_ccontext = dom_canvas.getContext('2d')
// -> The canvas's image itself
/** @type {HTMLImageElement} */
var g_base_image = new Image()
// -> Rect drawing variables
/** @type {boolean} */
var g_leftMouseIsDown = false
/** @type {number} */
var g_mousemovecounter = 0
// (TODO: All 'Element' types)
/** @type {Rect[]} */
var g_rects = []
/** @type {number} */
var g_x_start = 0.0
/** @type {number} */
var g_y_start = 0.0

/* ## Rotation setting variables ## */
/** @type {HTMLInputElement} */
const dom_rotation_input = document.querySelector("#rotation_range")
/** @type {Element} */
const dom_rotation_value = document.querySelector("#rotation_value")
/** @type {boolean} */
var g_is_rotation_changed = false
/** @type {number} */
var g_rotation = Number(dom_rotation_input.value)

/* ## DPI setting variables ## */
// -> DOM variables
/** @type {HTMLInputElement} */
const dom_dpi_input = document.querySelector("#dpi_range")
/** @type {Element} */
const dom_dpi_value = document.querySelector("#dpi_value")
// -> Value variables
/** @type {boolean} */
var g_is_dpi_changed = false
/** @type {number} */
var g_dpi = Number(dom_dpi_input.value)
/* ## Black & white binarization variables ##  */
// -> DOM variable
/** @type {HTMLInputElement} */
const dom_binarization_is_active = document.querySelector("#binarization_is_active")
// -> Value variable
/** @type {boolean} */
var g_is_binarized = dom_binarization_is_active.checked
/* ## Black & white binarization variables ## */
// -> DOM variables
/** @type {HTMLInputElement} */
const dom_binarization_input = document.querySelector("#binarization_range")
/** @type {Element} */
const dom_binarization_value = document.querySelector("#binarization_value")
// -> Value variables
/** @type {boolean} */
var g_is_binarization_changed = false
/** @type {number} */
var g_binarization_threshold = Number(dom_binarization_input.value)


/* # 3. SERVER COMMUNICATION HANDLERS & FUNCTIONS SECTION # */
/* ## Server->Client handlers ## */
socket.on('connect', function () {
    // alert("Connected!")
})

socket.on("data_update", function (json) {
    // Set current page
    dom_current_page.value = json["current_page"]
    g_current_page = json["current_page"]
    // Set full page count
    dom_page_number.textContent = json["page_number"]
    // Set tesseract path
    dom_tesseract_path.textContent = json["tesseract_path"]
    // Set tesseract arguments
    dom_tesseract_arguments.value = json["tesseract_arguments"]
    // Set tesseract languages
    dom_tesseract_language_1.value = json["tesseract_language_1"]
    dom_tesseract_language_2.value = json["tesseract_language_2"]
    // Set X zoom
    g_x_zoom_factor = json["x_zoom"] / 100
    dom_x_zoom_input.value = json["x_zoom"]
    dom_x_zoom_value.textContent = json["x_zoom"]
    // Set Y zoom
    g_y_zoom_factor = json["y_zoom"] / 100
    dom_y_zoom_input.value = json["y_zoom"]
    dom_y_zoom_value.textContent = json["y_zoom"]
    // Set transcript text
    dom_text_area.value = json["text"]
    // Set rotation
    g_rotation = json["rotation"]
    dom_rotation_input.value = json["rotation"]
    dom_rotation_value.textContent = json["rotation"]
    // Set DPI
    g_dpi = json["dpi"]
    dom_dpi_input.value = json["dpi"]
    dom_dpi_value.textContent = json["dpi"]
    // Set binarization activation
    g_is_binarized = json["is_binarized"]
    dom_binarization_is_active.checked = json["is_binarized"]
    // Set binarization threshold
    g_binarization_threshold = json["binarization_threshold"]
    dom_binarization_input.value = json["binarization_threshold"]
    dom_binarization_value.textContent = json["binarization_threshold"]
    // Set rects
    /** @type {Rect[]} */
    let new_rects = []
    for (let rect_data of json["rects"]) {
        /** @type {Rect} */
        let rect = {
            x: rect_data["x"],
            y: rect_data["y"],
            w: rect_data["w"],
            h: rect_data["h"],
            language_state: rect_data["language_state"],
            temp: false,
        }
        new_rects.push(rect)
    }
    g_rects = new_rects
    // Set transformed image
    g_base_image.src = json["image_base64"]
    g_base_image.onload = function () {
        zoom_canvas()
        redraw_canvas()
    }
})
socket.on("get_ocr", function (string) {
    append_string_to_textarea(string)
    handle_changed_text()
})
socket.on('get_tesseract_path', function (string) {
    dom_tesseract_path.textContent = string
})

/* ## Client->server functions ## */
/* ### "Indirect" functions (used internally in other client->server functions) ### */
/**
 * Handles a newly received image configuration change.
 */
function handle_changed_image_config() {
    /** @type {BaseImageConfig} - The currently set image configuration. */
    let image_config = {
        x_zoom: g_x_zoom_factor,
        y_zoom: g_y_zoom_factor,
        rotation: g_rotation,
        is_binarized: g_is_binarized,
        binarization_threshold: g_binarization_threshold,
        dpi: g_dpi,
    }
    socket.emit("set_changed_image_config", image_config)
}

/**
 * Handles a newly changed Rect status.
 */
function handle_changed_rects() {
    socket.emit("set_changed_rects", g_rects)
}

/**
 * Sends a new page signal to the OCRA server.
 *
 * @param {number} page The new page's number
 */
function send_new_page(page) {
    socket.emit("new_page", page)
}

/* ### "Direct" functions (reactiong to event and/or directly sending signal to server) ### */
/**
 * Adds a newline to the OCRA text area's text and
 * sends the signal to perform the OCR to the
 * OCRA server.py.
 */
function handle_appending_ocr() {
    append_string_to_textarea("\n")
    socket.emit("perform_ocr")
}
dom_ocr_append.onclick = function (event) {
    if (!event) {
        return
    }
    handle_appending_ocr()
}
/**
 * Sends a 'changed text' signal to the
 * OCRA text.py whenever the OCRA text area's
 * text is changed and the user clicked outside
 * of the area afterwards.
 */
function handle_changed_text() {
    socket.emit("changed_text", dom_text_area.value)
}
dom_text_area.onchange = function (event) {
    if (!event) {
        return
    }
    handle_changed_text()
}
/**
 * Sends the 'Open New PDF' signal to the OCRA server.py.
 */
function handle_open_new_pdf() {
    socket.emit("open_new_pdf")
}
dom_open_new_pdf.onclick = function (event) {
    if (!event) {
        return
    }
    handle_open_new_pdf()
}
/**
 * Sends the 'Open project folder...' signal to
 * the OCRA server.py.
 */
function handle_open_project_folder() {
    socket.emit("open_project_folder")
}
dom_open_project_folder.onclick = function (event) {
    if (!event) {
        return
    }
    handle_open_project_folder()
}
/**
 * Sends the 'Set tesseract path...' signal to
 * the OCRA server.py.
 */
function handle_set_tesseract_path() {
    socket.emit("set_tesseract_path")
}
dom_set_tesseract_path.onclick = function (event) {
    if (!event) {
        return
    }
    handle_set_tesseract_path()
}
/**
 * Handles the 'Go to page' button click by sending a new page signal.
 * Leads to an OCR server signal.
 */
function handle_goto_page() {
    send_new_page(Number(dom_current_page.value))
}
dom_page_goto.onclick = function (event) {
    if (!event) {
        return
    }
    handle_goto_page()
}
/* ## CLIENT->SERVER->CLIENT FUNCTIONS ## */
/**
 * Handles a new OCR start with clearing of the current transcript.
 * Leads to an OCR server signal.
 */
function handle_overwriting_ocr() {
    clear_textarea()
    socket.emit("perform_ocr")
}
dom_ocr_overwrite.onclick = function (event) {
    if (!event) {
        return
    }
    handle_overwriting_ocr()
}
/**
 * Handles going one page down (-1).
 * Leads to an OCR server signal.
 */
function handle_page_down() {
    if (g_current_page > 0) {
        send_new_page(g_current_page - 1)
    }
}
dom_page_down.onclick = function (event) {
    if (!event) {
        return
    }
    handle_page_down()
}
/**
 * Handles going one page down (+1).
 * Leads to an OCR server signal.
 */
function handle_page_up() {
    send_new_page(g_current_page + 1)
}
dom_page_up.onclick = function (event) {
    if (!event) {
        return
    }
    handle_page_up()
}
/**
 * Handles changing the Tesseract OCR arguments,
 * sends a coresponding signal to the OCR server.
 */
function handle_change_tesseract_arguments() {
    socket.emit("change_tesseract_arguments", dom_tesseract_arguments.value)
}
dom_tesseract_arguments.onchange = function (event) {
    if (!event) {
        return
    }
    handle_change_tesseract_arguments()
}
/**
 * Handles change of the two Tesseract languages.
 * Leads to an OCR server signal.
 */
function handle_change_tesseract_languages() {
    socket.emit("change_tesseract_languages", {
        "language_1": dom_tesseract_language_1.value,
        "language_2": dom_tesseract_language_2.value,
    })
}
dom_tesseract_language_1.onchange = function (event) {
    if (!event) {
        return
    }
    handle_change_tesseract_languages()
}
dom_tesseract_language_2.onchange = function (event) {
    if (!event) {
        return
    }
    handle_change_tesseract_languages()
}

/* # 4. INPUT EVENT LISTENERS FUNCTIONS SECTION # */
// X zoom
dom_x_zoom_value.textContent = dom_x_zoom_input.value
dom_x_zoom_input.addEventListener("input", (event) => {
    if (!event) {
        return
    }
    let target = event.target
    dom_x_zoom_value.textContent = target.value
    g_x_zoom_factor = Number(target.value) / 100
    zoom_canvas()
    redraw_canvas()
    handle_changed_image_config()
})

// Y zoom
dom_y_zoom_value.textContent = dom_y_zoom_input.value
dom_y_zoom_input.addEventListener("input", (event) => {
    if (!event) {
        return
    }
    let target = event.target
    dom_y_zoom_value.textContent = target.value
    g_y_zoom_factor = Number(target.value) / 100
    zoom_canvas()
    redraw_canvas()
    handle_changed_image_config()
})

// Rotation
dom_rotation_value.textContent = dom_rotation_input.value
dom_rotation_input.addEventListener("input", (event) => {
    if (!event) {
        return
    }
    let target = event.target
    dom_rotation_value.textContent = target.value
    g_is_rotation_changed = true
})
dom_rotation_input.onmouseleave = function (event) {
    if (!g_is_rotation_changed) {
        return
    }
    g_is_rotation_changed = false
    let target = event.target
    g_rotation = Number(target.value)
    handle_changed_image_config()
}

// DPI
dom_dpi_value.textContent = dom_dpi_input.value
dom_dpi_input.addEventListener("input", (event) => {
    if (!event) {
        return
    }
    let target = event.target
    dom_dpi_value.textContent = target.value
    g_is_dpi_changed = true
})

dom_dpi_input.onmouseleave = function (event) {
    if (!event) {
        return
    }
    if (!g_is_dpi_changed) {
        return
    }
    g_is_dpi_changed = false
    let target = event.target
    g_dpi = Number(target.value)
    handle_changed_image_config()
}

// Binarization activation
dom_binarization_is_active.addEventListener("click", (event) => {
    if (!event) {
        return
    }
    g_is_binarization_changed = true
    let target = event.target
    g_is_binarized = target.checked
    handle_changed_image_config()
})

// Binarization threshold
dom_binarization_value.textContent = dom_binarization_input.value
dom_binarization_input.addEventListener("input", (event) => {
    if (!event) {
        return
    }
    let target = event.target
    dom_binarization_value.textContent = target.value
    g_is_binarization_changed = true
})
dom_binarization_input.onmouseleave = function (event) {
    if (!event) {
        return
    }
    if (!g_is_binarization_changed) {
        return
    }
    g_is_binarization_changed = false
    let target = event.target
    g_binarization_threshold = Number(target.value)
    handle_changed_image_config()
}

/* # 5. CANVAS LOGIC SECTION # */
/* ## Canvas functions ## */
/**
 * Adds a Rect instance with the given parameters to the global rects variable. This global variable stores
 * all drawn Rect instances of the currently loaded page image.
 *
 * @param {number} x The Rect's X coordinate (left-to-right). Can be but should not be negative.
 * @param {number} y The Rect's Y coordinate (top-to-bottom). Can be but should not be negative.
 * @param {number} w The Rect's width in pixels. Can be negative.
 * @param {number} h The Rect's height in pixels. Can be negative.
 * @param {string} language_state The Rect's language state (i.e., whether the text marked by this
 * rect in the loaded image should be OCRed according to the 1st, 2nd or 1st+2nd given Tesseract language).
 * Must be one of "1", "2" or "1_and_2".
 * @param {boolean} temp Indicated whether this Rect is "temporary" (i.e., it shall not be send to the OCRA
 * server as the left mouse button is still down) or not. Is 'true' if temporary, 'false' if not.
 */
function add_rect(x, y, w, h, language_state, temp) {
    /** @type {Rect} */
    let rect = {
        x: x,
        y: y,
        w: w,
        h: h,
        language_state: language_state,
        temp: temp,
    }
    g_rects.push(rect)
}

/**
 * Clears (deletes) all current rects and sends corresponding signals.
 */
function clear_all_rects() {
    g_rects = []
    redraw_canvas()
    handle_changed_rects()
}
dom_clear_all_rects.onclick = function (event) {
    if (!event) {
        return
    }
    clear_all_rects()
}

/**
 * Draws the selected Rect in the canvas.
 *
 * @param {Rect} rect TODO The Rect that shall be drawn.
 * @param {number} rect_counter The Rect's index in the global Rect list.
 *                              Is drawn in a corner.
 */
function draw_rect(rect, rect_counter) {
    dom_ccontext.fillText(rect_counter.toString() + "_" + rect.language_state, rect.x * g_x_zoom_factor, rect.y * g_y_zoom_factor)
    dom_ccontext.strokeRect(rect.x * g_x_zoom_factor, rect.y * g_y_zoom_factor, rect.w * g_x_zoom_factor, rect.h * g_y_zoom_factor)
}
/**
 * Deletes (clears) all Rects which include the given 2D coordinate.
 *
 * @param {number} x X coordinate
 * @param  {number} y Y coordinate
 */
function delete_rects_at_position(x, y) {
    /** @type {number[]} */
    let deleted_rect_indexes = []
    /** @type {number} */
    let rect_counter = -1
    for (let rect of g_rects) {
        rect_counter++
        /** @type {number} */
        let x_upper_left = rect.x
        /** @type {number} */
        let x_lower_right = rect.x + rect.w
        if (rect.w < 0.0) {
            x_upper_left = rect.x + rect.w
            x_lower_right = rect.x
        }
        /** @type {number} */
        let y_upper_left = rect.y
        /** @type {number} */
        let y_lower_right = rect.y + rect.h
        if (rect.h <= 0.0) {
            y_lower_right = rect.y
            y_upper_left = rect.y + rect.h
        }
        if (x < x_upper_left) {
            continue
        }
        if (y < y_upper_left) {
            continue
        }
        if (x > x_lower_right) {
            continue
        }
        if (y > y_lower_right) {
            continue
        }
        deleted_rect_indexes.push(rect_counter)
    }
    for (let delete_rect_index of deleted_rect_indexes) {
        g_rects.splice(delete_rect_index, 1)
    }
    redraw_canvas()
}
/**
 * Clears and then redraws the whole canvas with the current content.
 */
function redraw_canvas() {
    // Clear canvas
    dom_ccontext.clearRect(0, 0, dom_canvas.width, dom_canvas.height)
    // Draw image
    dom_ccontext.drawImage(
        g_base_image, 0, 0, g_base_image.width, g_base_image.height, 0, 0, dom_canvas.width, dom_canvas.height
    )
    // Draw all rects
    /** @type {number} */
    let rect_counter = 0
    for (let rect of g_rects) {
        draw_rect(rect, rect_counter)
        rect_counter++
    }
}
/**
 * Zooms the canvas widget according to the current settings.
 */
function zoom_canvas() {
    dom_canvas.width = g_base_image.width * g_x_zoom_factor
    dom_canvas.height = g_base_image.height * g_y_zoom_factor
}
/* ## Canvas input listeners ## */
dom_canvas.onmousedown = function (event) {
    if (!event) {
        return
    }
    /** @type {number} */
    let x = event.pageX - dom_canvas.offsetLeft
    /** @type {number} */
    let y = event.pageY - dom_canvas.offsetTop
    g_x_start = x / g_x_zoom_factor
    g_y_start = y / g_y_zoom_factor
    if (event.button == 0) {
        g_leftMouseIsDown = true
        return
    }
    else if (event.button != 1) {
        return
    }
    // Middle mouse logic
    delete_rects_at_position(g_x_start, g_y_start)
    handle_changed_rects()
}
dom_canvas.onmousemove = function (event) {
    if (!event) {
        return
    }
    g_mousemovecounter++
    if (g_mousemovecounter > 10000) {
        g_mousemovecounter = 0
    }
    if (g_mousemovecounter % 2) {
        return
    }
    if (!g_leftMouseIsDown) {
        return
    }
    /** @type {number} */
    let x = event.pageX - dom_canvas.offsetLeft
    /** @type {number} */
    let y = event.pageY - dom_canvas.offsetTop
    x /= g_x_zoom_factor
    y /= g_y_zoom_factor
    /** @type {number} */
    let w = x - g_x_start
    /** @type {number} */
    let h = y - g_y_start

    if (g_rects.length > 0) {
        let last_rect = g_rects.pop()
        if (!last_rect.temp) {
            g_rects.push(last_rect)
        }
    }
    /** @type {string} */
    const rect_language_state = document.querySelector('input[name="rect_language_state"]:checked')
    add_rect(g_x_start, g_y_start, w, h, rect_language_state.value, true)
    redraw_canvas()
}
dom_canvas.onmouseup = function (event) {
    if (!event) {
        return
    }
    if (!g_leftMouseIsDown) {
        return
    }
    g_leftMouseIsDown = false
    if (g_rects.length > 0) {
        g_rects.pop()
    }
    /** @type {number} */
    let x_end = event.pageX - dom_canvas.offsetLeft
    /** @type {number} */
    let y_end = event.pageY - dom_canvas.offsetTop
    x_end /= g_x_zoom_factor
    y_end /= g_y_zoom_factor
    /** @type {number} */
    let w = x_end - g_x_start
    /** @type {number} */
    let h = y_end - g_y_start
    /** @type {string} */
    const rect_language_state = document.querySelector('input[name="rect_language_state"]:checked')
    add_rect(g_x_start, g_y_start, w, h, rect_language_state.value, false)
    redraw_canvas()
    handle_changed_rects()
}

/* # 6. TEXTAREA FUNCTIONS SECTION # */
/**
 * Adds the given string to the OCRA text area's text. No newline is added anywhere.
 *
 * @param {string} string The string which will be added at the end of the OCRA text area's text.
 */
function append_string_to_textarea(string) {
    dom_text_area.value += string
}
/**
 * Deletes the content of the OCRA text area. Only "" is left afterwards.
 */
function clear_textarea() {
    dom_text_area.value = ""
}

/* # 7. STARTUP ROUTINE SECTION # */
// Load empty standard image at start-up
g_base_image.src = "static/Empty.png"
g_base_image.onload = function () {
    zoom_canvas()
    redraw_canvas()
}
