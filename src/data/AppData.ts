import { EventInfo } from "../model/EventInfo";

const allEvents = require("../events.json") as EventInfo[];
const allDates = ["08-06", "08-07", "08-08", "08-09", "08-10"];

export { allEvents, allDates };
