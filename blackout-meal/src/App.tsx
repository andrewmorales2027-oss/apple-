import { Build, Cola, Footer, Fries, Hero, Intro, Masthead, Order } from "./components/Sections";
import { HAS_PHOTOGRAPHY } from "./images/manifest";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#order">
        Skip to order
      </a>

      <Masthead />

      <main>
        <Hero />
        <Intro />
        <Build />
        <Fries />
        <Cola />
        <Order />
      </main>

      <Footer />

      {/* Development-only reminder. Stripped from the production bundle, and gone the
          moment the first photograph lands in src/assets/shots. */}
      {import.meta.env.DEV && !HAS_PHOTOGRAPHY && (
        <p
          style={{
            position: "fixed",
            insetInline: 0,
            bottom: 0,
            margin: 0,
            padding: "0.5rem 1rem",
            background: "#a8231b",
            color: "#f4efe4",
            font: "600 0.72rem/1.4 Karla, system-ui, sans-serif",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textAlign: "center",
            zIndex: 50,
          }}
        >
          No photography yet — drop files into src/assets/shots named after each slot
        </p>
      )}
    </>
  );
}
