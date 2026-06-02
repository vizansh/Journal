import { registerRootComponent } from "expo";
import MoodJournal from "./screens/MoodJournal";

function App() {
  return <MoodJournal />;
}

registerRootComponent(App);
