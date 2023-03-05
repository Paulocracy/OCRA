/**
 * TypeScript code for OCRA, the OCR Assistant.
 */
import io from 'socket.io-client'


/* CUSTOM TYPES SECTION */
type BaseImageConfig = {
    x_zoom: number
    y_zoom: number
    rotation: number
    is_binarized: boolean
    binarization_threshold: number
    dpi: number
}

type Rect = {
    x: number
    y: number
    w: number
    h: number
    language_state: string
    temp: boolean
}


/* GLOBAL VARIABLES SECTION */
// Server logic main variable
const socket = io()
// Tesseract variables
const tesseract_path = document.querySelector("#tesseract_path") as Element
const tesseract_arguments = document.querySelector("#tesseract_arguments") as HTMLInputElement
const tesseract_language_1 = document.querySelector("#tesseract_language_1") as HTMLInputElement
const tesseract_language_2 = document.querySelector("#tesseract_language_2") as HTMLInputElement

// Page variables
const current_page = document.querySelector("#current_page") as HTMLInputElement
const page_number = document.querySelector("#page_number") as Element
var g_current_page = 0

// Textarea variables
const text_area = document.querySelector("#text_field") as HTMLInputElement

// Image setting variables
// -> X zoom
const x_zoom_input = document.querySelector("#x_zoom_range") as HTMLInputElement
const x_zoom_value = document.querySelector("#x_zoom_value") as Element
var g_x_zoom_factor = Number(x_zoom_input.value) / 100
// -> Y zoom
const y_zoom_input = document.querySelector("#y_zoom_range") as HTMLInputElement
const y_zoom_value = document.querySelector("#y_zoom_value") as Element
var g_y_zoom_factor = Number(y_zoom_input.value) / 100
// -> Rotation
const rotation_input = document.querySelector("#rotation_range") as HTMLInputElement
const rotation_value = document.querySelector("#rotation_value") as Element
var g_rotation = Number(rotation_input.value)
// -> DPI
const dpi_input = document.querySelector("#dpi_range") as HTMLInputElement
const dpi_value = document.querySelector("#dpi_value") as Element
var g_dpi = Number(dpi_input.value)
// -> Black & white binarization activation
const binarization_is_active = document.querySelector("#binarization_is_active") as HTMLInputElement
var g_is_binarized: boolean = binarization_is_active.checked
// -> Black & white binarization threshold
const binarization_input = document.querySelector("#binarization_range") as HTMLInputElement
const binarization_value = document.querySelector("#binarization_value") as Element
var g_binarization_threshold = Number(binarization_input.value)

// Canvas logic variables
// -> The canvas itself
const g_canvas = document.getElementById('viewport') as HTMLCanvasElement
const g_context = g_canvas.getContext('2d') as CanvasRenderingContext2D
// -> The canvas's image itself
var g_base_image = new Image()
// -> Rect drawing variables
var g_rects: Rect[] = []
var g_x_start = 0.0
var g_y_start = 0.0
var g_leftMouseIsDown = false
var g_mousemovecounter: number = 0


/* SERVER COMMUNICATION FUNCTIONS SECTION */
socket.on('connect', function() {
    // alert("B")
})

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
function handle_open_project_folder() {
    socket.emit(
        "open_project_folder"
    )
}
function handle_open_new_pdf() {
    socket.emit(
        "open_new_pdf"
    )
}
function handle_changed_rects() {
    socket.emit(
        "set_changed_rects",
        g_rects
    )
}

function handle_changed_text() {
    socket.emit(
        "changed_text",
        text_area.value
    )
}

// Tesseract path handling
function handle_out_set_tesseract_path() {
    socket.emit(
        "set_tesseract_path"
    )
}
socket.on('get_tesseract_path', function(string) {
    tesseract_path.textContent = string
})

// OCR handling
function handle_overwriting_ocr() {
    clear_textarea()
    socket.emit(
        "perform_ocr"
    )
}
function handle_appending_ocr() {
    append_string_to_textarea("\n")
    socket.emit(
        "perform_ocr"
    )
}
socket.on(
    "get_ocr", function(string) {
        append_string_to_textarea(string)
        handle_changed_text()
    }
)

// Data update handling
socket.on("data_update", function(json) {
    // Set current page
    current_page.value = json["current_page"]
    g_current_page = json["current_page"]
    // Set full page count
    page_number.textContent = json["page_number"]
    // Set tesseract path
    tesseract_path.textContent = json["tesseract_path"]
    // Set tesseract arguments
    tesseract_arguments.value = json["tesseract_arguments"]
    // Set tesseract languages
    tesseract_language_1.value = json["tesseract_language_1"]
    tesseract_language_2.value = json["tesseract_language_2"]
    // Set X zoom
    g_x_zoom_factor = json["x_zoom"] / 100
    x_zoom_input.value = json["x_zoom"]
    x_zoom_value.textContent = json["x_zoom"]
    // Set Y zoom
    g_y_zoom_factor = json["y_zoom"] / 100
    y_zoom_input.value = json["y_zoom"]
    y_zoom_value.textContent = json["y_zoom"]
    // Set transcript text
    text_area.value = json["text"]
    // Set rotation
    g_rotation = json["rotation"]
    rotation_input.value = json["rotation"]
    rotation_value.textContent = json["rotation"]
    // Set DPI
    g_dpi = json["dpi"]
    dpi_input.value = json["dpi"]
    dpi_value.textContent = json["dpi"]
    // Set binarization activation
    g_is_binarized = json["is_binarized"]
    binarization_is_active.checked = json["is_binarized"]
    // Set binarization threshold
    g_binarization_threshold = json["binarization_threshold"]
    binarization_input.value = json["binarization_threshold"]
    binarization_value.textContent = json["binarization_threshold"]
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
    g_base_image.onload = function(){
        zoom_canvas()
        redraw_canvas()
    }
})

function handle_change_tesseract_arguments() {
    socket.emit(
        "change_tesseract_arguments",
        tesseract_arguments.value
    )
}

function handle_change_tesseract_languages() {
    socket.emit(
        "change_tesseract_languages",
        {
            "language_1": tesseract_language_1.value,
            "language_2": tesseract_language_2.value,
        }
    )
}

/* TEXTAREA FUNCTIONS SECTION */
function clear_textarea() {
    text_area.value = ""
}

function append_string_to_textarea(string) {
    text_area.value += string
}

/* IMAGE SETTINGS FUNCTIONS SECTION */
// X zoom
x_zoom_value.textContent = x_zoom_input.value
x_zoom_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    x_zoom_value.textContent = target.value
    g_x_zoom_factor = Number(target.value) / 100
    zoom_canvas()
    redraw_canvas()
    handle_changed_image_config()
})

// Y zoom
y_zoom_value.textContent = y_zoom_input.value
y_zoom_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    y_zoom_value.textContent = target.value
    g_y_zoom_factor = Number(target.value) / 100
    zoom_canvas()
    redraw_canvas()
    handle_changed_image_config()
})

// Rotation
rotation_value.textContent = rotation_input.value
rotation_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    rotation_value.textContent = target.value
    g_rotation = Number(target.value)
    handle_changed_image_config()
})

// DPI
dpi_value.textContent = dpi_input.value
dpi_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    dpi_value.textContent = target.value
    g_dpi = Number(target.value)
    handle_changed_image_config()
})

// Binarization activation
binarization_is_active.addEventListener("click", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    g_is_binarized = target.checked
    handle_changed_image_config()
})

// Binarization threshold
binarization_value.textContent = binarization_input.value
binarization_input.addEventListener("input", (event) => {
    if (!event) { return }
    let target = event.target as HTMLInputElement
    binarization_value.textContent = target.value
    g_binarization_threshold = Number(target.value)
    handle_changed_image_config()
})


/* CANVAS LOGIC FUNCTIONS SECTION */
g_canvas.onmousedown = function(e) {
    let x = e.pageX - g_canvas.offsetLeft
    let y = e.pageY - g_canvas.offsetTop

    g_x_start = x / g_x_zoom_factor
    g_y_start = y / g_y_zoom_factor

    if (e.button == 0) {
        g_leftMouseIsDown = true
        return
    } else if (e.button != 1) {
        return
    }

    // Middle mouse logic
    delete_rects_at_position(g_x_start, g_y_start)
    handle_changed_rects()
}

g_canvas.onmousemove = function(e) {
    g_mousemovecounter++
    if(g_mousemovecounter > 10000) { g_mousemovecounter=0 }
    if (g_mousemovecounter % 2) { return }
    if (!g_leftMouseIsDown) { return }
    let x = e.pageX - g_canvas.offsetLeft
    let y = e.pageY - g_canvas.offsetTop
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

g_canvas.onmouseup = function(e) {
    if (!g_leftMouseIsDown) { return }
    g_leftMouseIsDown = false

    if (g_rects.length > 0) {
        g_rects.pop()
    }

    let x_end = e.pageX - g_canvas.offsetLeft
    let y_end = e.pageY - g_canvas.offsetTop
    x_end /= g_x_zoom_factor
    y_end /= g_y_zoom_factor
    let w = x_end - g_x_start
    let h = y_end - g_y_start

    const rect_language_state = document.querySelector('input[name="rect_language_state"]:checked') as HTMLInputElement
    add_rect(g_x_start, g_y_start, w, h, rect_language_state.value, false)
    redraw_canvas()
    handle_changed_rects()
}

g_canvas.onmouseleave = function(e) {
    // Mouse leaves area
}



function redraw_canvas() {
    clear_canvas()
    draw_image()
    draw_all_rects()
}

function draw_rect(rect: Rect, rect_counter: number) {
    g_context.fillText(
        rect_counter.toString()+"_"+rect.language_state,
        rect.x * g_x_zoom_factor,
        rect.y * g_y_zoom_factor
    )
    g_context.strokeRect(
        rect.x * g_x_zoom_factor,
        rect.y * g_y_zoom_factor,
        rect.w * g_x_zoom_factor,
        rect.h * g_y_zoom_factor
    )
}

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

function clear_all_rects() {
    g_rects = []
    redraw_canvas()
    handle_changed_rects()
}

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

function draw_all_rects() {
    let rect_counter = 0
    for (let rect of g_rects) {
        draw_rect(rect, rect_counter)
        rect_counter++
    }
}

function clear_canvas() {
    g_context.clearRect(0, 0, g_canvas.width, g_canvas.height)
}

function draw_image() {
    g_context.drawImage(g_base_image, 0, 0, g_base_image.width, g_base_image.height, 0, 0, g_canvas.width, g_canvas.height)
}

function zoom_canvas() {
    g_canvas.width = g_base_image.width * g_x_zoom_factor
    g_canvas.height = g_base_image.height * g_y_zoom_factor
}

load_image('static/Empty.png')
function load_image(source) {
    g_base_image.src = source
    g_base_image.onload = function(){
        zoom_canvas()
        redraw_canvas()
    }
}

function send_new_page(page: number) {
    socket.emit(
        "new_page",
        page,
    )
}

function handle_page_down() {
    if (g_current_page > 0) {
        send_new_page(g_current_page-1)
    }
}

function handle_page_up() {
    send_new_page(g_current_page+1)
}

function handle_goto_page() {
    send_new_page(Number(current_page.value))
}
