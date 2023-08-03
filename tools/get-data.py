import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from dataclasses_json import dataclass_json

logger = logging.getLogger(__name__)


@dataclass_json
@dataclass
class SubEventInfo:
    ssid: str
    title: str
    link: str
    start: str
    end: str
    recorded: str
    streamed: str

    def __str__(self) -> str:
        return " | ".join([
            self.title,
            f"{self.start} - {self.end}",
            f"Recorded: {self.recorded}, Streamed: {self.streamed}",
        ])


@dataclass_json
@dataclass
class EventInfo:
    evid: str
    type_name: str
    title: str
    link: str
    location: str
    date: str
    start: str
    end: str
    recorded: str
    streamed: str
    sub_events: list[SubEventInfo]

    def __str__(self) -> str:
        return " | ".join([
            self.evid,
            self.type_name,
            self.title,
            self.location,
            f"{self.date} {self.start} - {self.end}",
            f"Recorded: {self.recorded}, Streamed: {self.streamed}",
        ])


def read_file(file: Path):
    with open(file, "r", encoding="utf-8") as f:
        return f.read()


def load_file(file: Path, url: str):
    if file.exists():
        return read_file(file)

    logger.info(f"Download {file.name}")
    r = requests.get(url)
    r.encoding = "utf-8"
    with open(file, "w", encoding="utf-8") as f:
        f.write(r.text)

    return read_file(file)


def get_text(node) -> str:
    text = node.text.strip().replace("\n", "")
    return " ".join(text.split())


def get_time(s_utc: str, e_utc: str) -> tuple[str, str, str]:
    offset = timedelta(hours=7)
    s_time = datetime.fromisoformat(s_utc.rstrip("Z")) - offset
    e_time = datetime.fromisoformat(e_utc.rstrip("Z")) - offset

    day = s_time.strftime("%m-%d")
    start = s_time.strftime("%H:%M")
    end = e_time.strftime("%H:%M")
    return day, start, end


def get_with_class(node, cls: str):
    return node.find_all(
        lambda t: t.has_attr("class") and cls in t["class"]
    )[0]


def parse_tags(tags: list[str]) -> tuple[str, str]:
    ev_recorded = "Unknown"
    if "Recorded" in tags:
        ev_recorded = "Yes"
    elif "Not Recorded" in tags:
        ev_recorded = "No"

    ev_streamed = "Unknown"
    if "Livestreamed" in tags:
        ev_streamed = "Yes"
    elif "Not Livestreamed" in tags:
        ev_streamed = "No"

    return ev_recorded, ev_streamed


def load_talk(evid: str, link: str, out_root: Path) -> list[SubEventInfo]:
    talk_root = out_root / "talks"
    talk_root.mkdir(parents=True, exist_ok=True)

    talk_file = talk_root / f"{evid}.html"
    talk_content = load_file(
        talk_file,
        link,
    )

    soup = BeautifulSoup(talk_content, features="lxml")
    results = []
    for tr in soup.find_all(lambda t: t.name == "tr" and "agenda-item" in t["class"]):
        ssid = tr["ssid"]
        _, ev_start, ev_end = get_time(tr["s_utc"], tr["e_utc"])
        title_a = get_with_class(tr, "title-speakers-td").find("a")
        ev_title = get_text(title_a)
        ev_link = "https://s2023.siggraph.org" + title_a["href"]

        tags = [node.text for node in get_with_class(
            tr, "ptrack-list").find_all(lambda t: t.name == "div" and "program-track" in t["class"])]
        ev_recorded, ev_streamed = parse_tags(tags)

        # special adjustment for layout
        if ev_title == "Eyes Without a Face" and ev_start == "16:52" and ev_end == "17:15":
            ev_start = "16:51"

        results.append(SubEventInfo(
            ssid,
            ev_title,
            ev_link,
            ev_start,
            ev_end,
            ev_recorded,
            ev_streamed,
        ))

    return results


def load_daily_event(day: int, out_root: Path, existing: set[str]) -> list[EventInfo]:
    list_root = out_root / "lists"
    list_root.mkdir(parents=True, exist_ok=True)

    list_file = list_root / f"08-{day:02d}.html"
    list_content = load_file(
        list_file,
        f"https://s2023.siggraph.org/wp-content/linklings_snippets/wp_program_view_all_2023-08-{day:02d}.txt",
    )

    soup = BeautifulSoup(list_content, features="lxml")
    recording_unhandled_types = set()
    results = []
    for tr in soup.find("table").children:
        if tr.name != "tr":
            continue
        if "agenda-item" not in tr["class"]:
            continue

        evid = tr["psid"]
        if evid in existing:
            continue
        existing.add(evid)

        sub_events = []

        ev_type = get_text(get_with_class(tr, "presentation-type"))
        if ev_type == "Job FairJob Fair Roundtable":
            ev_type = "Job Fair, Job Fair Roundtable"
        elif ev_type == "Electronic TheaterElectronic Theater Retrospective Celebration":
            ev_type = "Electronic Theater, Electronic Theater Retrospective Celebration"
        elif ev_type == "Art GalleryArt Papers":
            ev_type = "Art Gallery, Art Papers"

        title_span = get_with_class(tr, "presentation-title")
        ev_title = get_text(title_span)
        ev_link = title_span.find("a").attrs.get("href", "")
        if ev_link != "":
            ev_link = "https://s2023.siggraph.org" + ev_link

        ev_location = get_text(get_with_class(tr, "presentation-location"))

        ev_date, ev_start, ev_end = get_time(tr["s_utc"], tr["e_utc"])

        tags = [node.text for node in get_with_class(
            tr, "presentation-tags").find_all(lambda t: t.name == "div" and "program-track" in t["class"])]
        ev_recorded, ev_streamed = parse_tags(tags)

        if ev_type in {
            "Technical Paper",
            "Art Papers",
            "Art Gallery, Experience Presentation",
            "Experience Presentation, Immersive Pavilion, VR Theater",
        }:
            ev_recorded = "Yes"
            ev_streamed = "Yes"
        elif ev_type in {
            "Art Gallery",
            "Poster",
            "Emerging Technologies",
            "VR Theater",
            "Immersive Pavilion",
            "History",
            "Educator's Forum",
            "Exhibition",
            "Exhibitor Session",
            "Job Fair",
            "Affiliated Session",
            "Art Gallery",
            "Job Fair, Job Fair Roundtable",
            "Appy Hour",
            "Labs",
        }:
            ev_recorded = "No"
            ev_streamed = "No"
        elif ev_type == "Talk":
            sub_events = load_talk(evid, ev_link, out_root)
        else:
            if ev_recorded == "Unknown" or ev_streamed == "Unknown":
                recording_unhandled_types.add(ev_type)

        if "[IN-PERSON COURSE CANCELLED" in ev_title:
            ev_title = ev_title[:ev_title.find(" - [IN-PERSON")]
            ev_recorded = "Yes"

        results.append(EventInfo(
            evid,
            ev_type,
            ev_title,
            ev_link,
            ev_location,
            ev_date,
            ev_start,
            ev_end,
            ev_recorded,
            ev_streamed,
            sub_events,
        ))

        print(results[-1])
        if len(sub_events) > 0:
            for ev in sub_events:
                print(f"  {ev}")

    if len(recording_unhandled_types) > 0:
        logger.warning(
            f"New types requiring special handling for recording: [{'], ['.join(sorted(recording_unhandled_types))}]")
    logger.info(f"Day {day:02d} added {len(results)} events")
    return results


def load_all_events(out_root: Path):
    events = []
    existing = set()
    for day in range(6, 13):
        events += load_daily_event(day, out_root, existing)

    return events


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler()],
    )
    out_root = Path(__file__).parent.parent / f"local/data"
    events = load_all_events(out_root)

    with open(Path(__file__).parent.parent / f"src/events.json", "w", encoding="utf-8") as f:
        f.write(
            EventInfo.schema().dumps(events, many=True, indent=2, ensure_ascii=False, sort_keys=True)
        )


if __name__ == "__main__":
    main()
