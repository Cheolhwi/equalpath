import { Button, Note } from "../components/primitives.jsx";
import { useStore } from "../store/context.jsx";

export default function Welcome() {
  const { dispatch } = useStore();

  return (
    <div className="welcome">
      <div className="welcome__backdrop" aria-hidden="true">
        <span className="welcome__blob welcome__blob--blue" />
        <span className="welcome__blob welcome__blob--gold" />
      </div>

      <p className="welcome__mark">EqualPath</p>
      <h1>
        {"Know about\ntomorrow "}
        <em>tonight</em>
      </h1>
      <p>
        EqualPath watches the gap between your work and your childcare, and tells you the evening
        before it opens.
      </p>

      <div className="welcome__actions">
        <Button trailingIcon="arrowRight" onClick={() => dispatch({ type: "start-setup" })}>
          Set up EqualPath
        </Button>
        <Button variant="secondary" onClick={() => dispatch({ type: "load-sample" })}>
          Open with sample records
        </Button>
      </div>

      <div style={{ marginTop: "16px" }}>
        <Note>
          The iOS build signs in with Google so your rows are private to your account. This web build
          has no account at all: it keeps everything in this browser, so there is nothing to sign in
          to and nothing to sign out of.
        </Note>
      </div>
    </div>
  );
}
