export class SubEventInfo {
  ssid = "";
  title = "";
  link = "";
  start = "";
  end = "";
  recorded = "";
  streamed = "";
}

export class EventInfo {
  evid = "";
  type_name = "";
  title = "";
  link = "";
  location = "";
  date = "";
  start = "";
  end = "";
  recorded = "";
  streamed = "";
  sub_events: SubEventInfo[] = [];
}
