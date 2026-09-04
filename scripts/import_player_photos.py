#!/usr/bin/env python3
"""Download the approved public player portraits and link them in SQLite."""
from __future__ import annotations

import sqlite3
import shutil
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "sciclon2.sqlite3"
PUBLIC = ROOT / "web-stats" / "public" / "players"

PHOTOS = {
    "Yoann": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/e7b7ba2a-e6a4-4595-872d-d5d0c5d7a317/photo.png",
    "Andy S": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/e64e4234-25be-458f-93d0-fe97c68e907d/photo.png",
    "Gus": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/28ddde27-5feb-4253-acfb-1ce077811eb9/photo.png",
    "Pau": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/5565f9bd-069e-41b3-848b-0d5c5ee24cbd/photo.png",
    "Guille": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/5527a5cb-f306-4ebb-9da3-8c1f95f8361b/photo.png",
    "Pablo": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/e75a11d7-59a1-4893-943b-49057346de63/photo.png",
    "Aidan": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/3aabe6ee-3ef0-4913-9705-9bfa21425bfb/photo.png",
    "Andy C": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/fecf6853-1579-4969-a46a-6023ed7e14f7/photo.png",
    "Dani": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/c74f0190-2967-455e-92e8-4afe427e8112/photo.png",
    "Facu": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/f55fea58-86a9-4f80-af04-d37b0af17123/photo.png",
    "Niyi": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/bfb8fb55-3d80-4561-80aa-52115b616de5/photo.jpg",
    "Mark": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/59485d29-fc56-4534-99f7-a1387d5eacf3/photo.png",
    "Gimmi": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/762fdf2c-eaca-48cd-a30d-f36827efeb6f/photo.png",
    "Salsa": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/eb71b8ce-bc60-4e7c-85a5-416c5ce82615/photo.png",
    "Martin": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/717f01a4-b68b-48a1-896c-a077f1a18b60/photo.png",
    "Pete": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/88b9f175-8569-45e6-9878-4a2b82c4bf14/photo.png",
    "Mario": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/1f04add0-6c01-4329-9b71-47f76d23b2b5/photo.jpg",
    "Sergio": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/a994e152-2257-4c62-968e-b1c9d0e75b1d/photo.png",
    "Ivo": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/8db3227a-0120-4c54-a060-c660e6f7e44f/photo.png",
    "Mati": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/3941b3af-192b-4eff-adb7-8a600d495bc1/photo.png",
    "Alejandro": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/40ccc9fc-9b37-4d5c-a2b9-0f20bd82c8ae/photo.png",
    "Des": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/e480bbf2-976a-4a8b-8e5d-ee50f19eeb77/photo.png",
    "Milton": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/4a716b56-0b75-42d2-b974-23cb8290da07/photo.png",
    "Ryan W": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/bcb81588-fd73-4245-b080-038af337658a/photo.png",
    "Rasta": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/0bbd24f3-727a-4aec-b54b-0d1d02f1e9b1/photo.png",
    "Ryan H": "https://krqmoiozdsrxkbkkarza.supabase.co/storage/v1/object/public/player-photos/b026630f-278b-4200-a202-784b44904d9b/photo.png",
}


def slug(name: str) -> str:
    return name.lower().replace(" ", "-")


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB)
    try:
        for name, url in PHOTOS.items():
            suffix = Path(url).suffix
            filename = f"{slug(name)}{suffix}"
            destination = PUBLIC / filename
            with urllib.request.urlopen(url, timeout=30) as response:
                content_type = response.headers.get_content_type()
                if content_type not in {"image/png", "image/jpeg"}:
                    raise ValueError(f"Unexpected content type for {name}: {content_type}")
                destination.write_bytes(response.read())
            if shutil.which("sips"):
                subprocess.run(
                    ["sips", "-Z", "360", str(destination)],
                    check=True,
                    stdout=subprocess.DEVNULL,
                )
            updated = connection.execute(
                "UPDATE players SET photo_path=?, photo_source_url=?, updated_at=CURRENT_TIMESTAMP "
                "WHERE canonical_name=?",
                (f"/players/{filename}", url, name),
            ).rowcount
            if updated != 1:
                raise ValueError(f"Player not found or duplicated: {name}")
        connection.commit()
    finally:
        connection.close()
    print(f"Imported {len(PHOTOS)} player photos into {PUBLIC}")


if __name__ == "__main__":
    main()
