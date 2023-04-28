/**
 * TypeScript code for OCRA, the OCR Assistant.
 *
 * CODE REMARKS:
 * >Aimed code comment style: https://tsdoc.org/
 * >Global DOM-related variables are prefixes with "dom_"
 * >Global non-DOM variables are prefixed with "g_"
 */
/* # IMPORTS SECTION # */
import io from 'socket.io-client'



/* # CUSTOM TYPES SECTION # */
/**
 * Representation of the current page's image transformation settings.
 */
type BaseImageConfig = {
    /** Current X axis zoom  in % */
    x_zoom: number
    /** Current Y axis zoom in % */
    y_zoom: number
    /** Current image rotation in degrees (°) */
    rotation: number
    /** Indicates whether or not the current page is black&white-binarized */
    is_binarized: boolean
    /** If is_binarized is true, indicated the black&white binarization threshold */
    binarization_threshold: number
    /** The current page image's DPI. Changes of it also affect the coordinate sytem */
    dpi: number
}

/**
 * Represents a user-drawn rectangle for marking an OCR area.
 */
type Rect = {
    /** The X coordinate of the Rect's upper left corner */
    x: number
    /** The Y coordinate of the Rect's upper left corner */
    y: number
    /** The Rect's width */
    w: number
    /** The Rect's height */
    h: number
    /** Either '1', '2' or '1_and_2', used according to the current languages. */
    language_state: string
    /** Is true if the Rect is currently drawn (mouse down), false as soon as the mouse is up. */
    temp: boolean
}



/* # GLOBAL VARIABLES SECTION #
   Sorted after appearance in OCRA's GUI, starting from the top left in left-to-right direction.
*/
/* ## SERVER LOGIC MAIN VARIABLEE */
const socket = io()

/* ## TESSERACT CONFIG VARIABLES ## */
const dom_set_tesseract_path = document.querySelector("#set_tesseract_path") as HTMLInputElement
const dom_tesseract_path = document.querySelector("#tesseract_path") as Element
const dom_tesseract_arguments = document.querySelector("#tesseract_arguments") as HTMLInputElement
const dom_tesseract_language_1 = document.querySelector("#tesseract_language_1") as HTMLInputElement
const dom_tesseract_language_2 = document.querySelector("#tesseract_language_2") as HTMLInputElement

/* ## OPEN PDF/PROJECT VARIABLES ## */
const dom_open_project_folder = document.querySelector("#open_project_folder") as HTMLInputElement
const dom_open_new_pdf = document.querySelector("#open_new_pdf") as HTMLInputElement

/* ## PAGE CONTROL VARIABLES ## */
const dom_page_down = document.querySelector("#page_down") as HTMLInputElement
const dom_current_page = document.querySelector("#current_page") as HTMLInputElement
const dom_page_number = document.querySelector("#page_number") as Element
const dom_page_goto = document.querySelector("#page_goto") as HTMLInputElement
const dom_page_up = document.querySelector("#page_up") as HTMLInputElement
var g_current_page = 0

/* ## RUN OCR VARIABLES ## */
const dom_ocr_overwrite = document.querySelector("#ocr_overwrite") as HTMLInputElement
const dom_ocr_append = document.querySelector("#ocr_append") as HTMLInputElement

/* ## CLEAR RECTS VARIABLE ## */
const dom_clear_all_rects = document.querySelector("#clear_all_rects") as HTMLInputElement

/* ## X ZOOM VARIABLES ## */
const dom_x_zoom_input = document.querySelector("#x_zoom_range") as HTMLInputElement
const dom_x_zoom_value = document.querySelector("#x_zoom_value") as Element
var g_x_zoom_factor = Number(dom_x_zoom_input.value) / 100

/* ## Y ZOOM VARIABLES ## */
const dom_y_zoom_input = document.querySelector("#y_zoom_range") as HTMLInputElement
const dom_y_zoom_value = document.querySelector("#y_zoom_value") as Element
var g_y_zoom_factor = Number(dom_y_zoom_input.value) / 100

/* ## TEXTAREA VARIABLE ## */
const dom_text_area = document.querySelector("#text_field") as HTMLInputElement

/* ## CANVAS AND CANVAS LOGIC VARIABLES ## */
// -> The canvas itself
const dom_canvas = document.getElementById('viewport') as HTMLCanvasElement
const dom_ccontext = dom_canvas.getContext('2d') as CanvasRenderingContext2D
// -> The canvas's image itself
var g_base_image = new Image()
// -> Rect drawing variables
var g_leftMouseIsDown = false
var g_mousemovecounter: number = 0
var g_rects: Rect[] = []
var g_x_start = 0.0
var g_y_start = 0.0

/* ## ROTATION SETTING VARIABLES ## */
const dom_rotation_input = document.querySelector("#rotation_range") as HTMLInputElement
const dom_rotation_value = document.querySelector("#rotation_value") as Element
var g_is_rotation_changed = false
var g_rotation = Number(dom_rotation_input.value)

/* ## DPI SETTING VARIABLES ## */
const dom_dpi_input = document.querySelector("#dpi_range") as HTMLInputElement
const dom_dpi_value = document.querySelector("#dpi_value") as Element
var g_is_dpi_changed = false
var g_dpi = Number(dom_dpi_input.value)

/* ## BLACK & WHITE BINARIZATION ACTIVATION ##  */
const dom_binarization_is_active = document.querySelector("#binarization_is_active") as HTMLInputElement
var g_is_binarized: boolean = dom_binarization_is_active.checked

/* ## BLACK & WHITE BINARIZATION THRESHOLD ## */
const dom_binarization_input = document.querySelector("#binarization_range") as HTMLInputElement
const dom_binarization_value = document.querySelector("#binarization_value") as Element
var g_is_binarization_changed = false
var g_binarization_threshold = Number(dom_binarization_input.value)



/* # SERVER COMMUNICATION FUNCTIONS SECTION # */
/* ## SERVER->CLIENT FUNCTIONS ## */
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
    let new_rects: Rect[] = []
    for (let rect_data of json["rects"]) {
        let rect: Rect = {
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

socket.on(
    "get_ocr", function (string: string) {
        append_string_to_textarea(string)
        handle_changed_text()
    }
)

socket.on('get_tesseract_path', function (string) {
    dom_tesseract_path.textContent = string
})

/* ## CLIENT->SERVER FUNCTIONS ## */
/* ### 'INDIRECT' FUNCTIONS (USED BY OTHER CLIENT->SERVER FUNCTIONS) ### */
/**
 * Handles a newly received image configuration change.
 */
function handle_changed_image_config() {
    let image_config: BaseImageConfig = {
        x_zoom: g_x_zoom_factor,
        y_zoom: g_y_zoom_factor,
        rotation: g_rotation,
        is_binarized: g_is_binarized,
        binarization_threshold: g_binarization_threshold,
        dpi: g_dpi,
    }
    socket.emit(
        "set_changed_image_config",
        image_config
    )
}

/**
 * Handles a newly changed Rect status.
 */
function handle_changed_rects() {
    socket.emit(
        "set_changed_rects",
        g_rects
    )
}

/**
 * Sends a new page signal to the OCRA server.
 *
 * @param page The new page's number
 */
function send_new_page(page: number) {
    socket.emit(
        "new_page",
        page,
    )
}

/* ### 'DIRECT' FUNCTIONS (REACTING TO EVENT AND/OR DIRECTLY SENDING SIGNAL TO SERVER) ### */
/**
 * Adds a newline to the OCRA text area's text and
 * sends the signal to perform the OCR to the
 * OCRA server.py.
 */
function handle_appending_ocr() {
    append_string_to_textarea("\n")
    socket.emit(
        "perform_ocr"
    )
}
dom_ocr_append.onclick = function (event) {
    if (!event) { return }
    handle_appending_ocr()
}

/**
 * Sends a 'changed text' signal to the
 * OCRA text.py whenever the OCRA text area's
 * text is changed and the user clicked outside
 * of the area afterwards.
 */
function handle_changed_text() {
    socket.emit(
        "changed_text",
        dom_text_area.value
    )
}
dom_text_area.onchange = function (event) {
    if (!event) { return }
    handle_changed_text()
}

/**
 * Sends the 'Open New PDF' signal to the OCRA server.py.
 */
function handle_open_new_pdf() {
    socket.emit(
        "open_new_pdf"
    )
}
dom_open_new_pdf.onclick = function (event) {
    if (!event) {return}
    handle_open_new_pdf()
}

/**
 * Sends the 'Open project folder...' signal to
 * the OCRA server.py.
 */
function handle_open_project_folder() {
    socket.emit(
        "open_project_folder"
    )
}
dom_open_project_folder.onclick = function (event) {
    if (!event) { return }
    handle_open_project_folder()
}

/**
 * Sends the 'Set tesseract path...' signal to
 * the OCRA server.py.
 */
function handle_set_tesseract_path() {
    socket.emit(
        "set_tesseract_path"
    )
}
dom_set_tesseract_path.onclick = function (event) {
    if (!event) { return }
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
    if (!event) { return }
    handle_goto_page()
}

/* ## CLIENT->SERVER->CLIENT FUNCTIONS ## */


/**
 * Handles a new OCR start with clearing of the current transcript.
 * Leads to an OCR server signal.
 */
function handle_overwriting_ocr() {
    clear_textarea()
    socket.emit(
        "perform_ocr"
    )
}
dom_ocr_overwrite.onclick = function (event) {
    if (!event) { return }
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
    if (!event) { return }
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
    if (!event) { return }
    handle_page_up()
}


/**
 * Handles changing the Tesseract OCR arguments,
 * sends a coresponding signal to the OCR server.
 */
function handle_change_tesseract_arguments() {
    socket.emit(
        "change_tesseract_arguments",
        dom_tesseract_arguments.value
    )
}
dom_tesseract_arguments.onchange = function (event) {
    if (!event) { return }
    handle_change_tesseract_arguments()
}

/**
 * Handles change of the two Tesseract languages.
 * Leads to an OCR server signal.
 */
function handle_change_tesseract_languages() {
    socket.emit(
        "change_tesseract_languages",
        {
            "language_1": dom_tesseract_language_1.value,
            "language_2": dom_tesseract_language_2.value,
        }
    )
}
dom_tesseract_language_1.onchange = function (event) {
    if (!event) { return }
    handle_change_tesseract_languages()
}
dom_tesseract_language_2.onchange = function (event) {
    if (!event) { return }
    handle_change_tesseract_languages()
}



/* # INPUT EVENT LISTENERS FUNCTIONS SECTION # */
// X zoom
dom_x_zoom_value.textContent = dom_x_zoom_input.value
dom_x_zoom_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    dom_x_zoom_value.textContent = target.value
    g_x_zoom_factor = Number(target.value) / 100
    zoom_canvas()
    redraw_canvas()
    handle_changed_image_config()
})

// Y zoom
dom_y_zoom_value.textContent = dom_y_zoom_input.value
dom_y_zoom_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    dom_y_zoom_value.textContent = target.value
    g_y_zoom_factor = Number(target.value) / 100
    zoom_canvas()
    redraw_canvas()
    handle_changed_image_config()
})

// Rotation
dom_rotation_value.textContent = dom_rotation_input.value
dom_rotation_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    dom_rotation_value.textContent = target.value
    g_is_rotation_changed = true
})
dom_rotation_input.onmouseleave = function (event) {
    if (!g_is_rotation_changed) { return }
    g_is_rotation_changed = false
    let target = event.target as HTMLInputElement
    g_rotation = Number(target.value)
    handle_changed_image_config()
}

// DPI
dom_dpi_value.textContent = dom_dpi_input.value
dom_dpi_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    dom_dpi_value.textContent = target.value
    g_is_dpi_changed = true
})
dom_dpi_input.onmouseleave = function (event) {
    if (!event) { return }
    if (!g_is_dpi_changed) { return }
    g_is_dpi_changed = false
    let target = event.target as HTMLInputElement
    g_dpi = Number(target.value)
    handle_changed_image_config()
}

// Binarization activation
dom_binarization_is_active.addEventListener("click", (event) => {
    if (!event) { return }
    g_is_binarization_changed = true
    let target = event.target as HTMLInputElement
    g_is_binarized = target.checked
    handle_changed_image_config()
})

// Binarization threshold
dom_binarization_value.textContent = dom_binarization_input.value
dom_binarization_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    dom_binarization_value.textContent = target.value
    g_is_binarization_changed = true
})
dom_binarization_input.onmouseleave = function (event) {
    if (!event) { return }
    if (!g_is_binarization_changed) { return }
    g_is_binarization_changed = false
    let target = event.target as HTMLInputElement
    g_binarization_threshold = Number(target.value)
    handle_changed_image_config()
}


/* # CANVAS LOGIC SECTION # */
/* ## CANVAS FUNCTIONS ## */
/**
 * Adds a Rect instance with the given parameters to the global rects variable. This global variable stores
 * all drawn Rect instances of the currently loaded page image.
 *
 * @param x number describing the Rect's X coordinate (left-to-right). Can be but should not be negative.
 * @param y number describing the Rect's Y coordinate (top-to-bottom). Can be but should not be negative.
 * @param w number describing the Rect's width in pixels. Can be negative.
 * @param h number describing the Rect's height in pixels. Can be negative.
 * @param language_state string describing the Rect's language state (i.e., whether the text marked by this
 * rect in the loaded image should be OCRed according to the 1st, 2nd or 1st+2nd given Tesseract language).
 * Must be one of "1", "2" or "1_and_2".
 * @param temp boolean displaying whether this Rect is "temporary" (i.e., it shall not be send to the OCRA
 * server as the left mouse button is still down) or not. Is 'true' if temporary, 'false' if not.
 */
function add_rect(x: number, y: number, w: number, h: number, language_state: string, temp: boolean) {
    let rect: Rect = {
        x: x,
        y: y,
        w: w,
        h: h,
        language_state: language_state,
        temp: temp,
    }
    g_rects.push(
        rect
    )
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
    if (!event) { return }
    clear_all_rects()
}

/**
 * Draws the selected Rect in the canvas.
 *
 * @param rect The Rect that shall be drawn.
 * @param rect_counter The Rect's index in the global Rect list.
 *                     Is drawn in a corner.
 */
function draw_rect(rect: Rect, rect_counter: number) {
    dom_ccontext.fillText(
        rect_counter.toString() + "_" + rect.language_state,
        rect.x * g_x_zoom_factor,
        rect.y * g_y_zoom_factor
    )
    dom_ccontext.strokeRect(
        rect.x * g_x_zoom_factor,
        rect.y * g_y_zoom_factor,
        rect.w * g_x_zoom_factor,
        rect.h * g_y_zoom_factor
    )
}

/**
 * Deletes (clears) all Rects which include the given 2D coordinate.
 *
 * @param x X coordinate
 * @param y Y coordinate
 */
function delete_rects_at_position(x: number, y: number) {
    let deleted_rect_indexes: number[] = []
    let rect_counter = -1
    for (let rect of g_rects) {
        rect_counter++

        let x_upper_left = rect.x
        let x_lower_right = rect.x + rect.w
        if (rect.w < 0.0) {
            x_upper_left = rect.x + rect.w
            x_lower_right = rect.x
        }

        let y_upper_left = rect.y
        let y_lower_right = rect.y + rect.h
        if (rect.h <= 0.0) {
            y_lower_right = rect.y
            y_upper_left = rect.y + rect.h
        }

        if (x < x_upper_left) { continue }
        if (y < y_upper_left) { continue }
        if (x > x_lower_right) { continue }
        if (y > y_lower_right) { continue }

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
        g_base_image, 0,
        0, g_base_image.width, g_base_image.height,
        0, 0,
        dom_canvas.width, dom_canvas.height
    )
    // Draw all rects
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


/* ## CANVAS INPUT LISTENERS ## */
dom_canvas.onmousedown = function (event) {
    if (!event) { return }

    let x = event.pageX - dom_canvas.offsetLeft
    let y = event.pageY - dom_canvas.offsetTop

    g_x_start = x / g_x_zoom_factor
    g_y_start = y / g_y_zoom_factor

    if (event.button == 0) {
        g_leftMouseIsDown = true
        return
    } else if (event.button != 1) {
        return
    }

    // Middle mouse logic
    delete_rects_at_position(g_x_start, g_y_start)
    handle_changed_rects()
}

dom_canvas.onmousemove = function (event) {
    if (!event) { return }
    g_mousemovecounter++
    if (g_mousemovecounter > 10000) { g_mousemovecounter = 0 }
    if (g_mousemovecounter % 2) { return }
    if (!g_leftMouseIsDown) { return }
    let x = event.pageX - dom_canvas.offsetLeft
    let y = event.pageY - dom_canvas.offsetTop
    x /= g_x_zoom_factor
    y /= g_y_zoom_factor
    let w = x - g_x_start
    let h = y - g_y_start

    if (g_rects.length > 0) {
        let last_rect = g_rects.pop() as Rect
        if (!last_rect.temp) {
            g_rects.push(last_rect)
        }
    }
    const rect_language_state = document.querySelector('input[name="rect_language_state"]:checked') as HTMLInputElement
    add_rect(g_x_start, g_y_start, w, h, rect_language_state.value, true)

    redraw_canvas()
}

dom_canvas.onmouseup = function (event) {
    if (!event) { return }
    if (!g_leftMouseIsDown) { return }
    g_leftMouseIsDown = false

    if (g_rects.length > 0) {
        g_rects.pop()
    }

    let x_end = event.pageX - dom_canvas.offsetLeft
    let y_end = event.pageY - dom_canvas.offsetTop
    x_end /= g_x_zoom_factor
    y_end /= g_y_zoom_factor
    let w = x_end - g_x_start
    let h = y_end - g_y_start

    const rect_language_state = document.querySelector('input[name="rect_language_state"]:checked') as HTMLInputElement
    add_rect(g_x_start, g_y_start, w, h, rect_language_state.value, false)
    redraw_canvas()
    handle_changed_rects()
}



/* # TEXTAREA FUNCTIONS SECTION # */
/**
 * Adds the given string to the OCRA text area's text. No newline is added anywhere.
 *
 * @param string The string which will be added at the end of the OCRA text area's text.
 */
function append_string_to_textarea(string: string) {
    dom_text_area.value += string
}

/**
 * Deletes the content of the OCRA text area. Only "" is left afterwards.
 */
function clear_textarea() {
    dom_text_area.value = ""
}



/* # STARTUP ROUTINE SECTION # */
// Load empty standard image at start-up
g_base_image.src = "static/Empty.png"
g_base_image.onload = function () {
    zoom_canvas()
    redraw_canvas()
}
