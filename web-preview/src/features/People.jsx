import { useState } from "react";

import { Button, Card, Eyebrow, Field, Note } from "../components/primitives.jsx";
import { useStore } from "../store/context.jsx";

export default function People() {
  const { state, dispatch } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");

  const circle = state.supportNetwork.filter((person) => !person.isOwner);

  const save = () => {
    if (name.trim().length === 0) return;
    dispatch({ type: "add-person", name, relationship });
    setName("");
    setRelationship("");
    setAdding(false);
  };

  return (
    <div className="screen">
      <div className="screen__inner">
        <Eyebrow>Support circle</Eyebrow>
        <h2 className="screen__title">People you trust</h2>
        <p className="screen__lede">
          No request is automatic. A person receives only the details you approve for a specific gap —
          and in this iteration, nothing is sent at all.
        </p>

        {circle.length === 0 ? (
          <Card>
            <p className="row__subtitle">
              Nobody is recorded yet. EqualPath still finds gaps; it just cannot suggest someone from
              your support circle.
            </p>
          </Card>
        ) : (
          <div className="card card--flush">
            {circle.map((person, index) => (
              <div className="row" key={person.id} style={index === 0 ? { borderTop: "none" } : undefined}>
                <span
                  className="avatar"
                  style={{ "--accent": person.availability === "AVAILABLE" ? "var(--green-text)" : "var(--orange)" }}
                >
                  {person.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="row__body">
                  <span className="row__title">{person.name}</span>
                  <span className="row__subtitle">{person.relationship}</span>
                </span>
                <span className="row__trailing">
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      color: person.availability === "AVAILABLE" ? "var(--green-text)" : "var(--orange)"
                    }}
                  >
                    {person.availability}
                  </span>
                  <button
                    type="button"
                    className="link-button link-button--danger"
                    onClick={() => dispatch({ type: "remove-person", id: person.id })}
                  >
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {adding ? (
          <Card>
            <div className="stack">
              <Field id="person-name" label="Name" placeholder="Farid" value={name} onChange={(event) => setName(event.target.value)} />
              <Field
                id="person-relationship"
                label="Relationship"
                placeholder="Partner"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
              />
              <div className="btn-row">
                <Button onClick={save}>Add</Button>
                <Button variant="secondary" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Button variant="secondary" icon="plus" onClick={() => setAdding(true)}>
            Add someone
          </Button>
        )}

        <Note>
          People added here can be chosen as the adult responsible for a drop-off or collection, which
          is what lets EqualPath work out whether a handover is physically possible. Carers never need
          to install anything.
        </Note>
      </div>
    </div>
  );
}
