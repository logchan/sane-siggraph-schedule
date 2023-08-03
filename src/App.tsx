import { ViewState } from '@devexpress/dx-react-scheduler';
import {
  Appointments,
  DayView,
  Scheduler
} from '@devexpress/dx-react-scheduler-material-ui';
import { Button, Container, Stack, Typography } from "@mui/material";
import Paper from '@mui/material/Paper';
import { useState } from "react";
import { allDates, allEvents } from "./data/AppData";
import { EventInfo, SubEventInfo } from "./model/EventInfo";

const filteredTypes = [
  "ACM SIGGRAPH Award Talk",
  "Electronic Theater Retrospective Celebration",
  "Job Fair Roundtable",
];

const filteredEvents = [
  "Labs Installations",
  "Labs Demo Schedule for Tuesday",
  "Labs Demo Schedule for Wednesday",
  "Labs Demo Schedule for Thursday",
];

const defaultEnabledTypes = [
  "Course",
  "Keynote",
  "Production Session",
  "Real-Time Live!",
  "Talk",
];

const defaultDisabledTypes = [
  "Birds of a Feather",
  "Electronic Theater",
  "Poster",
  "Technical Paper",
  "VR Theater",
];

interface ISchedulerData {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  event: EventInfo;
  subEvent: SubEventInfo | null;
}

const allSchedulerData: ISchedulerData[] = allEvents.filter(ev => !filteredEvents.some(s => s === ev.title)).map(ev => (
  {
    id: ev.evid,
    startDate: `2023-${ev.date}T${ev.start}`,
    endDate: `2023-${ev.date}T${ev.end}`,
    title: ev.title,
    event: ev,
    subEvent: null,
  }
));
const allSchedulerDataBrokenDown = allSchedulerData.reduce((list, data) => {
  const ev = data.event;

  if (ev.sub_events.length === 0) {
    list.push(data);
    return list;
  }

  ev.sub_events.forEach(sev => {
    list.push({
      id: `${ev.evid}-${sev.ssid}`,
      startDate: `2023-${ev.date}T${sev.start}`,
      endDate: `2023-${ev.date}T${sev.end}`,
      title: `${ev.title} | ${sev.title}`,
      event: ev,
      subEvent: sev,
    });
  });
  return list;
}, [] as (ISchedulerData[]));


const allTypes = Array.from(allEvents.reduce((set, ev) => {
  ev.type_name.split(", ").forEach(tp => set.add(tp));
  return set;
}, new Set<string>()).values()).sort().filter(tp => !filteredTypes.some(t => t === tp));

function RenderAppointment(props: Appointments.AppointmentProps) {
  const data = props.data as ISchedulerData;
  const event = data.event;
  const subEvent = data.subEvent;
  const recorded = subEvent?.recorded ?? event.recorded;
  const streamed = subEvent?.streamed ?? event.streamed;
  const start = subEvent?.start ?? event.start;
  const end = subEvent?.end ?? event.end;

  return (
    <Appointments.Appointment
      data={props.data}
      draggable={props.draggable}
      resources={props.resources}
    >
      <Stack
        direction="column"
        className="appointment-item"
      >
        <Stack direction="column">
          <Stack direction="row" spacing={1}>
            <Stack direction="row">
              <span className={`recorded-streamed recorded-streamed-${recorded}`}>R</span>
              <span className={`recorded-streamed recorded-streamed-${streamed}`}>S</span>
            </Stack>
            <span className="appointment-type">{event.type_name} {start}-{end}</span>
          </Stack>
          <span className="appointment-title">
            <a href={subEvent?.link ?? (event.link === "" ? "https://s2023.siggraph.org/full-program" : event.link)} target="_blank">{subEvent?.title ?? event.title}</a>
          </span>
          {subEvent === null ? null :
            <span className="appointment-subtitle">
              <a href={event.link} target="_blank">({event.title})</a></span>
          }
        </Stack>
      </Stack>
    </Appointments.Appointment>
  );
}

const TimeTableCell = (props: any) => {
  return <DayView.TimeTableCell {...props} className="higher-time-table-cell" />;
};
const TimeLabel = (props: any) => {
  return <DayView.TimeScaleLabel {...props} className="higher-time-label" />;
};
const TickCell = (props: any) => {
  return (
    <DayView.TimeScaleTickCell {...props} className="higher-time-table-cell" />
  );
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(allDates[0]);
  const [enabledTypes, setEnabledTypes] = useState<string[]>(JSON.parse(localStorage.getItem("sane-sg23-enabled-types") || JSON.stringify(defaultEnabledTypes)));
  const [disabledTypes, setDisabledTypes] = useState<string[]>(JSON.parse(localStorage.getItem("sane-sg23-disabled-types") || JSON.stringify(defaultDisabledTypes)));
  const [onlyNotRecorded, setOnlyNotRecorded] = useState(JSON.parse(localStorage.getItem("sane-sg23-only-not-recorded") || "false"));
  const [breakDown, setBreakDown] = useState(JSON.parse(localStorage.getItem("sane-sg23-breakdown") || "true"));

  const updateTypeSelection = (enabled: string[], disabled: string[]) => {
    localStorage.setItem("sane-sg23-enabled-types", JSON.stringify(enabled));
    localStorage.setItem("sane-sg23-disabled-types", JSON.stringify(disabled));
    setEnabledTypes(enabled);
    setDisabledTypes(disabled);
  };
  const toggleOnlyNotRecorded = () => {
    localStorage.setItem("sane-sg23-only-not-recorded", JSON.stringify(!onlyNotRecorded));
    setOnlyNotRecorded(!onlyNotRecorded);
  };
  const toggleBreakdown = () => {
    localStorage.setItem("sane-sg23-breakdown", JSON.stringify(!breakDown));
    setBreakDown(!breakDown);
  };

  // not the best practice but I'm in a hurry
  const schedulerData = (breakDown ? allSchedulerDataBrokenDown : allSchedulerData).filter(data => {
    if (disabledTypes.some(t => data.event.type_name.indexOf(t) >= 0)) {
      return false;
    }

    const recorded = data.subEvent?.recorded ?? data.event.recorded;
    if (onlyNotRecorded && recorded === "Yes") {
      return false;
    }

    if (enabledTypes.length === 0) {
      return true;
    }

    return enabledTypes.some(t => data.event.type_name.indexOf(t) >= 0);
  });

  return (
    <Container
      maxWidth={false}
      sx={{
        marginTop: "12px",
        marginBottom: "24px",
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h4">Sane SIGGRAPH Schedule (2023)</Typography>
        <Stack direction="row" spacing={2}>
          {allDates.map(date => (
            <Button
              key={date}
              variant="outlined"
              color={currentDate === date ? "success" : "info"}
              onClick={() => setCurrentDate(date)}
            >{date}</Button>
          ))}
        </Stack>
        <Stack
          direction="row"
          columnGap={1}
          rowGap={1}
          flexWrap="wrap"
        >
          <Button
            variant="outlined"
            color={onlyNotRecorded ? "success" : "info"}
            onClick={toggleOnlyNotRecorded}
          >Hide Recorded</Button>
          <Button
            variant="outlined"
            color={breakDown ? "success" : "info"}
            onClick={toggleBreakdown}
          >Break Down Talks</Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => updateTypeSelection([], disabledTypes)}
          >Clear Enabled</Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => updateTypeSelection(enabledTypes, [])}
          >Clear Disabled</Button>
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => updateTypeSelection(defaultEnabledTypes, defaultDisabledTypes)}
          >Restore Default</Button>
        </Stack>
        <Stack
          direction="row"
          columnGap={1}
          rowGap={1}
          flexWrap="wrap"
        >
          {allTypes.map(tp => (
            <Button
              key={tp}
              variant="outlined"
              color={enabledTypes.some(t => t === tp) ? "success" :
                disabledTypes.some(t => t === tp) ? "error" : "info"}
              onClick={() => {
                if (enabledTypes.some(t => t === tp)) {
                  updateTypeSelection(
                    enabledTypes.filter(t => t !== tp),
                    [...disabledTypes, tp],
                  );
                }
                else if (disabledTypes.some(t => t === tp)) {
                  updateTypeSelection(
                    enabledTypes,
                    disabledTypes.filter(t => t !== tp),
                  );
                }
                else {
                  updateTypeSelection(
                    [...enabledTypes, tp],
                    disabledTypes,
                  );
                }
              }}
            >{tp}</Button>
          ))}
        </Stack>
        <Paper id="main-scheduler">
          <Scheduler
            data={schedulerData}
          >
            <ViewState
              currentDate={"2023-" + currentDate}
            />
            <DayView
              startDayHour={7}
              endDayHour={23}
              timeTableCellComponent={TimeTableCell}
              timeScaleLabelComponent={TimeLabel}
              timeScaleTickCellComponent={TickCell}
            />
            <Appointments appointmentComponent={RenderAppointment} />
          </Scheduler>
        </Paper>
        <Stack>
          <Typography variant="body1">
            Disclaimer:
            This website is not an official product from SIGGRAPH or ACM. The information displayed are not guarenteed to be correct or up-to-date. The author is not liable for any damage caused by use of this website.
          </Typography>
          <Typography variant="body1">
            You are highly recommended to double check with the <a href="https://s2023.siggraph.org/full-program/" target="_blank">SIGGRAPH 2023 official website</a>.
          </Typography>
          <Typography variant="body1">
            The source code of this website is available on <a href="https://github.com/logchan/sane-siggraph-schedule" target="_blank">GitHub</a>.
          </Typography>
        </Stack>
      </Stack>
    </Container>
  );
}
