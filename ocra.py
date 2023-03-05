from pydantic import BaseModel
from pydantic.tools import parse_obj_as
from typing import Any
from utils import (
    combine_folder_and_file_path,
    ensure_folder_existence,
    json_load,
    json_write,
    standardize_file_path,
    standardize_folder_path,
    get_filenames_of_folder,
)
import pytesseract
from shutil import copy
import fitz
from PIL import Image
import os
import base64
from io import BytesIO
from time import sleep


class Rect(BaseModel):
    coord_x: int
    coord_y: int
    width: int
    height: int
    language_state: str


class ImageConfig(BaseModel):
    x_zoom: int = 50
    y_zoom: int = 50
    rotation: int = 0
    is_binarized: bool = False
    binarization_threshold: int = 130
    dpi: int = 400
    rects: list[Rect] = []


class TesseractConfig(BaseModel):
    command_path: str = ""
    extra_arguments: str = ""
    language_1: str = ""
    language_2: str = ""


class OCRAProject:
    def __init__(self):
        self.folder_path: str = ""
        self.current_image_config: ImageConfig = ImageConfig()
        self.tesseract_config: TesseractConfig = TesseractConfig()
        self.current_page: int = 1
        self.pdf_document = fitz.Document()

    def get_transformed_images_path(self) -> str:
        return standardize_folder_path(
            folder_path=f"{self.folder_path}transformed_images/"
        )

    def get_image_configs_path(self) -> str:
        return standardize_folder_path(folder_path=f"{self.folder_path}image_configs/")

    def get_current_image_config_file_path(self) -> str:
        return f"{self.get_image_configs_path()}{self.current_page}.json"

    def get_current_image_config(self) -> ImageConfig:
        return parse_obj_as(ImageConfig, json_load(file_path=self.get_current_image_config_file_path()))

    def get_rect_images_path(self) -> str:
        return standardize_folder_path(folder_path=f"{self.folder_path}rect_images/")

    def get_image_transcripts_path(self) -> str:
        return standardize_folder_path(
            folder_path=f"{self.folder_path}image_transcripts/"
        )

    def get_tesseract_config_file_path(self) -> str:
        return standardize_file_path(
            file_path=f"{self.folder_path}tesseract_config.json"
        )

    def get_current_transformed_image_file_path(self) -> str:
        return standardize_file_path(
            file_path=f"{self.get_transformed_images_path()}{self.current_page}.png"
        )

    def get_current_page_file_path(self) -> str:
        return standardize_file_path(file_path=f"{self.folder_path}current_page.json")

    def get_transformed_images_path(self) -> str:
        return standardize_folder_path(
            folder_path=f"{self.folder_path}transformed_images/"
        )

    def ensure_current_transformed_image_existence(self) -> None:
        if not os.path.isfile(self.get_current_transformed_image_file_path()):
            self.transform_current_image()

    def ensure_current_image_config(self) -> None:
        if not os.path.isfile(self.get_current_image_config_file_path()):
            self.current_image_config = ImageConfig()
            self.write_current_image_config()

    def get_current_rect_image_path(self, rect_number: int) -> str:
        return f"{self.get_rect_images_path()}{self.current_page}_{rect_number}.png"

    def get_existing_current_rect_images(self) -> list[str]:
        return [
            x for x in
            get_filenames_of_folder(folder_path=self.get_rect_images_path())
            if x.startswith(str(self.current_page)+"_")
        ]

    def create_rect_images(self) -> None:
        self.ensure_current_transformed_image_existence()
        for file in self.get_existing_current_rect_images():
            while not os.access(self.get_rect_images_path()+file, mode=os.W_OK):
                sleep(0.1)
            os.remove(self.get_rect_images_path()+file)
        image = Image.open(self.get_current_transformed_image_file_path())
        rect_counter = 0
        for rect in self.current_image_config.rects:
            if rect.width >= 0.0:
                x_upper_left = rect.coord_x
                x_lower_right = rect.coord_x + rect.width
            else:
                x_upper_left = rect.coord_x + rect.width
                x_lower_right = rect.coord_x
            if rect.height >= 0.0:
                y_upper_left = rect.coord_y
                y_lower_right = rect.coord_y + rect.height
            else:
                y_lower_right = rect.coord_y
                y_upper_left = rect.coord_y + rect.height
            cropped_image = image.crop((x_upper_left, y_upper_left, x_lower_right, y_lower_right))
            cropped_image.save(self.get_current_rect_image_path(rect_counter))
            rect_counter += 1
        image.close()

    def transform_current_image(self) -> None:
        self.ensure_current_image_config()

        image_path = self.get_current_transformed_image_file_path()

        page = self.pdf_document.load_page(self.current_page-1)
        image = page.get_pixmap(
            matrix=fitz.Matrix(
                self.current_image_config.dpi / 72, self.current_image_config.dpi / 72
            )
        )

        # while not os.access(image_path, os.R_OK):
        #     sleep(0.5)

        image.save(image_path)
        image = Image.open(image_path)
        image = image.rotate(self.current_image_config.rotation)
        if self.current_image_config.is_binarized:
            image = image.convert("1", dither=Image.NONE)
            image = image.point(
                lambda p: p > self.current_image_config.binarization_threshold and 255
            )
        # while not os.access(image_path, os.W_OK):
        #     sleep(0.5)
        image.save(image_path)
        image.close()

    def get_project_pdf_file_path(self) -> str:
        return f"{self.folder_path}file.pdf"

    def write_tesseract_config(self) -> None:
        with open(self.get_tesseract_config_file_path(), "w", encoding="utf-8") as f:
            f.write(self.tesseract_config.json())

    def write_current_page(self) -> None:
        json_write(file_path=self.get_current_page_file_path(), json_data=1)

    def write_current_image_config(self) -> None:
        json_write(file_path=self.get_current_image_config_file_path(), json_data=self.current_image_config.dict())

    def load_ocra_project(self, *, folder_path: str) -> None:
        folder_path = standardize_folder_path(folder_path=folder_path)
        self.folder_path = folder_path

        pdf_destination = self.get_project_pdf_file_path()
        self.pdf_document = fitz.open(pdf_destination)

        self.tesseract_config = parse_obj_as(
            TesseractConfig, json_load(file_path=self.get_tesseract_config_file_path())
        )
        self.current_page: int = json_load(
            file_path=self.get_current_page_file_path()
        )
        self.current_image_config = self.get_current_image_config()

        self.ensure_current_transformed_image_existence()

    def create_project_from_pdf(self, *, pdf_file_path: str, folder_path: str) -> None:
        pdf_file_path = standardize_file_path(file_path=pdf_file_path)
        folder_path = standardize_folder_path(folder_path=folder_path)

        ensure_folder_existence(folder_path=folder_path)
        self.folder_path = folder_path

        pdf_destination = self.get_project_pdf_file_path()
        copy(pdf_file_path, pdf_destination)

        ensure_folder_existence(folder_path=f"{self.folder_path}")
        ensure_folder_existence(folder_path=self.get_transformed_images_path())
        ensure_folder_existence(folder_path=self.get_image_transcripts_path())
        ensure_folder_existence(folder_path=self.get_rect_images_path())
        ensure_folder_existence(folder_path=self.get_image_configs_path())

        self.tesseract_config = TesseractConfig()
        self.write_tesseract_config()
        self.current_page = 1
        self.write_current_page()
        self.current_image_config = ImageConfig()
        self.ensure_current_image_config()
        self.write_current_image_config()

        self.load_ocra_project(folder_path=folder_path)

    def move_to_page(self, *, new_page: int) -> None:
        self.current_page = new_page
        self.ensure_current_transformed_image_existence()
        self.ensure_current_image_config()
        self.write_current_page()
        self.current_image_config = self.get_current_image_config()
        self.data_update_json()

    def change_tesseract_path(self, *, tesseract_path: str) -> None:
        self.tesseract_config.command_path = tesseract_path
        self.write_tesseract_config()

    def change_tesseract_arguments(self, *, arguments: str) -> None:
        self.tesseract_config.extra_arguments = arguments
        self.write_tesseract_config()

    def change_tesseract_languages(self, *, languages_json: dict[str, str]) -> None:
        self.tesseract_config.language_1 = languages_json["language_1"]
        self.tesseract_config.language_2 = languages_json["language_2"]
        self.write_tesseract_config()

    def set_changed_rects_from_json(self, *, rects_json: dict[str, float]) -> None:
        new_rects: list[Rect] = []
        for json_rect in rects_json:
            new_rect = Rect(
                coord_x=json_rect["x"],
                coord_y=json_rect["y"],
                width=json_rect["w"],
                height=json_rect["h"],
                language_state=json_rect["language_state"],
            )
            new_rects.append(new_rect)
        self.current_image_config.rects = new_rects
        self.write_current_image_config()

    def set_changed_image_config_from_json(
        self, *, config_json: dict[str, float | int | bool]
    ) -> bool:
        new_image_config = ImageConfig(
            x_zoom=config_json["x_zoom"] * 100,
            y_zoom=config_json["y_zoom"] * 100,
            rotation=config_json["rotation"],
            is_binarized=config_json["is_binarized"],
            binarization_threshold=config_json["binarization_threshold"],
            dpi=config_json["dpi"],
            rects=self.current_image_config.rects,
        )

        is_effectively_changed = False
        if new_image_config.rotation != self.current_image_config.rotation:
            is_effectively_changed = True
        if new_image_config.is_binarized != self.current_image_config.is_binarized:
            is_effectively_changed = True
        if (
            new_image_config.binarization_threshold
            != self.current_image_config.binarization_threshold
        ):
            is_effectively_changed = True
        if new_image_config.dpi != self.current_image_config.dpi:
            is_effectively_changed = True

        self.current_image_config = new_image_config
        self.write_current_image_config()
        if not is_effectively_changed:
            return False

        self.transform_current_image()
        return True

    def get_current_image_transcript_file_path(self) -> str:
        return f"{self.get_image_transcripts_path()}{self.current_page}.txt"

    def set_current_image_transcript(self, text: str) -> None:
        with open(self.get_current_image_transcript_file_path(), "w", encoding="utf-8") as f:
            f.write(text)

    def get_current_image_transcript(self) -> str:
        transcript_path = self.get_current_image_transcript_file_path()
        if os.path.exists(transcript_path):
            with open(transcript_path, "r", encoding="utf-8") as f:
                text = f.read()
        else:
            text = ""
        return text

    def get_current_transformed_image_as_base64(self) -> str:
        image = Image.open(self.get_current_transformed_image_file_path())
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        base64_str = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode(
            "utf-8"
        )
        image.close()
        return base64_str

    def data_update_json(self) -> dict[str, Any]:
        rects = []
        for rect in self.current_image_config.rects:
            rects.append(
                {
                    "x": rect.coord_x,
                    "y": rect.coord_y,
                    "w": rect.width,
                    "h": rect.height,
                    "language_state": rect.language_state,
                }
            )
        data_update_json = {
            "page_number": len(self.pdf_document),
            "current_page": self.current_page,
            "tesseract_path": self.tesseract_config.command_path,
            "tesseract_arguments": self.tesseract_config.extra_arguments,
            "tesseract_language_1": self.tesseract_config.language_1,
            "tesseract_language_2": self.tesseract_config.language_2,
            "x_zoom": self.current_image_config.x_zoom,
            "y_zoom": self.current_image_config.y_zoom,
            "text": self.get_current_image_transcript(),
            "rotation": self.current_image_config.rotation,
            "dpi": self.current_image_config.dpi,
            "is_binarized": self.current_image_config.is_binarized,
            "binarization_threshold": self.current_image_config.binarization_threshold,
            "rects": rects,
            "image_base64": self.get_current_transformed_image_as_base64(),
        }
        return data_update_json

    def get_lang_string(self, string: str) -> str:
        return string if (string != "") else "eng"

    def perform_ocr(self) -> str:
        pytesseract.pytesseract.tesseract_cmd = self.tesseract_config.command_path
        self.create_rect_images()
        rect_image_paths = self.get_existing_current_rect_images()
        ocr_string = f"~PAGE {self.current_page}~\n"
        rect_counter = 0
        for rect_image_path in rect_image_paths:
            rect_image_path = self.get_rect_images_path() + rect_image_path
            current_rect = self.current_image_config.rects[rect_counter]
            if current_rect.language_state == "1":
                lang = self.get_lang_string(self.tesseract_config.language_1)
            elif current_rect.language_state == "2":
                lang = self.get_lang_string(self.tesseract_config.language_2)
            elif current_rect.language_state == "1_and_2":
                lang = self.get_lang_string(self.tesseract_config.language_1) + "+" + self.get_lang_string(self.tesseract_config.language_2)
            config = self.tesseract_config.extra_arguments
            with Image.open(rect_image_path) as rect_image:
                tesseract_result = pytesseract.image_to_string(image=rect_image, lang=lang, config=config)
            ocr_string += f"↓↓↓↓↓START RECT {rect_counter}\n"
            ocr_string += tesseract_result
            ocr_string += f"↑↑↑↑↑END RECT {rect_counter}\n"
            rect_image.close()
            rect_counter += 1
        return ocr_string
