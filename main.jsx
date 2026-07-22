import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Atom, Plus, X, Upload, Check, Trash2, Pencil, Image as ImageIcon,
  Calendar, Clock, MapPin, ChevronRight, Menu, ArrowUpRight, Sparkles,
  FlaskConical, Cpu, Code2, HeartPulse, ShieldCheck, Loader2
} from "lucide-react";
import { storeGet, storeSet, testConnection } from "./firebase.js";

/* ---------------------------------------------------------------------
   TOKENS
   bg-void        #06060c
   ion-violet     #8b5cf6
   nucleus-magenta#d946ef
   photon-cyan    #22d3ee
   mist           #b9bad8
   signal-white   #f5f4fb
--------------------------------------------------------------------- */

const TRACKS = {
  science:  { label: "Science",  color: "#8b5cf6", Icon: FlaskConical },
  robotics: { label: "Robotics", color: "#22d3ee", Icon: Cpu },
  code:     { label: "Code",     color: "#d946ef", Icon: Code2 },
  health:   { label: "Health",   color: "#34d8a3", Icon: HeartPulse },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

async function fileToCompressedDataUrl(file, maxW = 900, quality = 0.7) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/* ---------------------------------------------------------------------
   CONNECTION BANNER — shows a clear on-screen message instead of a
   silently-failing save or an endless spinner.
--------------------------------------------------------------------- */
function ConnectionBanner() {
  const [status, setStatus] = useState({ checked: false, ok: true, message: "" });

  useEffect(() => {
    let live = true;
    testConnection().then((r) => { if (live) setStatus({ checked: true, ...r }); });
    return () => { live = false; };
  }, []);

  if (!status.checked || status.ok) return null;

  return (
    <div className="conn-banner">
      <strong>Can't reach the database.</strong> Nothing will save until this
      is fixed — check that <code>src/firebase.js</code> has your real Firebase
      config (not the placeholder values) and that Firestore rules allow
      access.
      <div className="conn-banner-detail">{status.message}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   SIGNATURE ATOM
--------------------------------------------------------------------- */
function AtomMark({ size = 120 }) {
  return (
    <div className="atom-mark" style={{ width: size, height: size }}>
      <div className="orbit orbit-a" />
      <div className="orbit orbit-b" />
      <div className="orbit orbit-c" />
      <div className="nucleus" />
    </div>
  );
}

/* ---------------------------------------------------------------------
   SEED DATA (only used the very first time storage is empty)
--------------------------------------------------------------------- */
const SEED_ABOUT =
  "Scale Up Nano (NSNN) is our school's nanoscience club. We meet to take " +
  "ideas from the whiteboard down to the atomic scale — and back up into " +
  "real projects — across four tracks: science, robotics, code, and health. " +
  "Every session is hands-on. Every member leaves with something they built.";

const SEED_EVENTS = [
  {
    id: uid(),
    track: "science",
    title: "How Small Can We Go? — Intro to Nanotech",
    description:
      "A first look at the nanoscale: what it is, why materials behave " +
      "differently down there, and where nanotech already shows up in " +
      "daily life. No background needed.",
    date: "2026-08-14",
    time: "16:00",
    location: "Lab 3",
    createdAt: Date.now(),
    fields: [
      { id: uid(), type: "text", label: "Full name", required: true },
      { id: uid(), type: "text", label: "Grade / class", required: true },
      {
        id: uid(), type: "choice", label: "Have you attended a club session before?",
        required: true, options: ["Yes", "No, first time"],
      },
      {
        id: uid(), type: "text", label: "One question you want answered by the end",
        required: false,
      },
    ],
  },
];

/* =======================================================================
   FIELD RENDERERS
======================================================================= */
function FieldInput({ field, value, onChange }) {
  if (field.type === "text") {
    return (
      <textarea
        className="f-input"
        rows={field.long ? 3 : 1}
        placeholder="Type your answer"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "choice") {
    return (
      <div className="f-options">
        {(field.options || []).map((opt) => (
          <button
            type="button"
            key={opt}
            className={"f-option" + (value === opt ? " f-option-active" : "")}
            onClick={() => onChange(opt)}
          >
            {value === opt && <Check size={14} />}
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (field.type === "file") {
    return (
      <label className="f-file">
        <Upload size={16} />
        <span>{value ? "Photo attached — tap to replace" : "Upload a photo"}</span>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const compressed = await fileToCompressedDataUrl(file);
            onChange(compressed);
          }}
        />
        {value && <img src={value} alt="" className="f-file-preview" />}
      </label>
    );
  }
  return null;
}

/* =======================================================================
   EVENT MODAL (participant fill)
======================================================================= */
function EventModal({ event, onClose, onSubmitted }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const track = TRACKS[event.track] || TRACKS.science;

  const setAns = (fid, val) => setAnswers((a) => ({ ...a, [fid]: val }));

  const missingRequired = (event.fields || []).some(
    (f) => f.required && !answers[f.id]
  );

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const key = `responses:${event.id}`;
      const existing = (await storeGet(key)) || [];
      const entry = { id: uid(), submittedAt: Date.now(), answers };
      const ok = await storeSet(key, [...existing, entry]);
      if (!ok) throw new Error("save failed");
      setDone(true);
      onSubmitted?.();
    } catch (e) {
      setError("Couldn't save your answers — check your internet connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <div className="modal-eyebrow" style={{ color: track.color }}>
          <track.Icon size={14} /> {track.label.toUpperCase()} TRACK
        </div>
        <h2 className="modal-title">{event.title}</h2>
        <p className="modal-desc">{event.description}</p>
        <div className="meta-row">
          <span><Calendar size={14} /> {event.date || "TBA"}</span>
          <span><Clock size={14} /> {event.time || "TBA"}</span>
          <span><MapPin size={14} /> {event.location || "TBA"}</span>
        </div>

        {done ? (
          <div className="done-state">
            <Check size={28} />
            <p>Your answers are in. See you there.</p>
          </div>
        ) : (
          <>
            <div className="form-divider" />
            <div className="form-fields">
              {(event.fields || []).map((f) => (
                <div className="field-block" key={f.id}>
                  <label className="field-label">
                    {f.label} {f.required && <span className="req">*</span>}
                  </label>
                  <FieldInput
                    field={f}
                    value={answers[f.id]}
                    onChange={(v) => setAns(f.id, v)}
                  />
                </div>
              ))}
              {(event.fields || []).length === 0 && (
                <p className="empty-note">No form has been attached to this event yet.</p>
              )}
            </div>
            {error && <p className="error-note">{error}</p>}
            <button
              className="btn btn-primary btn-block"
              disabled={missingRequired || submitting || (event.fields || []).length === 0}
              onClick={submit}
            >
              {submitting ? <Loader2 className="spin" size={16} /> : "Submit answers"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* =======================================================================
   PUBLIC SITE
======================================================================= */
function PublicSite() {
  const [about, setAbout] = useState(SEED_ABOUT);
  const [events, setEvents] = useState([]);
  const [memories, setMemories] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [memoryModalEvent, setMemoryModalEvent] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, e, m] = await Promise.all([
      storeGet("about"),
      storeGet("events"),
      storeGet("memories"),
    ]);
    setAbout(a?.text ?? SEED_ABOUT);
    if (e) setEvents(e); else { setEvents(SEED_EVENTS); storeSet("events", SEED_EVENTS); }
    setMemories(m || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = [...events].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sorted.filter((e) => !e.date || e.date >= today);
  const past = sorted.filter((e) => e.date && e.date < today);

  return (
    <div className="page">
      <ConnectionBanner />
      <nav className="nav">
        <div className="nav-brand">
          <AtomMark size={30} />
          <div>
            <div className="brand-name">SCALE UP <span className="grad">NANO</span></div>
            <div className="brand-sub">N S N N</div>
          </div>
        </div>
        <button className="nav-burger" onClick={() => setNavOpen((v) => !v)}><Menu size={20} /></button>
        <div className={"nav-links" + (navOpen ? " nav-links-open" : "")}>
          <a href="#about" onClick={() => setNavOpen(false)}>About</a>
          <a href="#events" onClick={() => setNavOpen(false)}>Events</a>
          <a href="#memories" onClick={() => setNavOpen(false)}>Memories</a>
        </div>
      </nav>

      <header className="hero">
        <AtomMark size={200} />
        <h1 className="hero-title">
          THE <span className="grad">NANOSCIENCE</span> CLUB
        </h1>
        <p className="hero-sub">
          Exploring science, robotics, code, and health — where every idea
          scales up into real discovery.
        </p>
        <a href="#events" className="btn btn-primary">
          See what's on <ChevronRight size={16} />
        </a>
      </header>

      <section id="about" className="section">
        <h2 className="section-title"><Sparkles size={18} /> About us</h2>
        <p className="about-text">{about}</p>
      </section>

      <section id="events" className="section">
        <h2 className="section-title"><Calendar size={18} /> Upcoming events</h2>
        {loading && <p className="empty-note">Loading events…</p>}
        {!loading && upcoming.length === 0 && (
          <p className="empty-note">Nothing scheduled yet — check back soon.</p>
        )}
        <div className="event-grid">
          {upcoming.map((ev) => {
            const track = TRACKS[ev.track] || TRACKS.science;
            return (
              <article
                className="event-card"
                key={ev.id}
                style={{ "--accent": track.color }}
                onClick={() => setActiveEvent(ev)}
              >
                <div className="event-track" style={{ color: track.color }}>
                  <track.Icon size={13} /> {track.label}
                </div>
                <h3 className="event-title">{ev.title}</h3>
                <p className="event-desc">{ev.description}</p>
                <div className="meta-row small">
                  <span><Calendar size={13} /> {ev.date || "TBA"}</span>
                  <span><Clock size={13} /> {ev.time || "TBA"}</span>
                  <span><MapPin size={13} /> {ev.location || "TBA"}</span>
                </div>
                <div className="event-cta">
                  Fill the form <ArrowUpRight size={14} />
                </div>
              </article>
            );
          })}
        </div>

        {past.length > 0 && (
          <>
            <h2 className="section-title muted-title">Past sessions</h2>
            <div className="event-grid">
              {past.map((ev) => {
                const track = TRACKS[ev.track] || TRACKS.science;
                return (
                  <article className="event-card past" key={ev.id} style={{ "--accent": track.color }}>
                    <div className="event-track" style={{ color: track.color }}>
                      <track.Icon size={13} /> {track.label}
                    </div>
                    <h3 className="event-title">{ev.title}</h3>
                    <div className="meta-row small">
                      <span><Calendar size={13} /> {ev.date}</span>
                    </div>
                    <button
                      className="event-cta as-button"
                      onClick={() => setMemoryModalEvent(ev)}
                    >
                      Add your memories <ImageIcon size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section id="memories" className="section">
        <h2 className="section-title"><ImageIcon size={18} /> Memories</h2>
        {memories.length === 0 ? (
          <p className="empty-note">No memories posted yet — they'll show up here after events.</p>
        ) : (
          <div className="memory-grid">
            {memories.flatMap((m) =>
              (m.images || []).map((img, i) => (
                <div className="memory-tile" key={m.id + i}>
                  <img src={img} alt={m.eventTitle} />
                  <div className="memory-caption">{m.eventTitle}</div>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <footer className="footer">
        <div className="footer-follow">FOLLOW &amp; JOIN</div>
        <div className="footer-handle">@scaleupnano</div>
        <div className="footer-note">NANOSCIENCE · SCHOOL CLUB · NSNN</div>
      </footer>

      {activeEvent && (
        <EventModal
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
          onSubmitted={() => {}}
        />
      )}
      {memoryModalEvent && (
        <MemoryUploadModal
          event={memoryModalEvent}
          onClose={() => setMemoryModalEvent(null)}
        />
      )}
    </div>
  );
}

/* =======================================================================
   PARTICIPANT MEMORY UPLOAD (goes to a pending queue for admin approval)
======================================================================= */
function MemoryUploadModal({ event, onClose }) {
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const key = "memoriesPending";
      const existing = (await storeGet(key)) || [];
      existing.push({
        id: uid(),
        eventId: event.id,
        eventTitle: event.title,
        image: preview,
        note,
        name,
        submittedAt: Date.now(),
      });
      const ok = await storeSet(key, existing);
      if (!ok) throw new Error("save failed");
      setSent(true);
    } catch (e) {
      setError("Couldn't upload your photo — check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2 className="modal-title">Add your memories</h2>
        <p className="modal-desc">Share a photo from "{event.title}". It'll appear on the Memories wall once approved.</p>
        {sent ? (
          <div className="done-state">
            <Check size={28} />
            <p>Thanks! Your photo is waiting for approval.</p>
          </div>
        ) : (
          <>
            <div className="form-fields">
              <div className="field-block">
                <label className="field-label">Your name</label>
                <input className="f-input single" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
              </div>
              <div className="field-block">
                <label className="field-label">Photo</label>
                <label className="f-file">
                  <Upload size={16} />
                  <span>{preview ? "Photo selected — tap to replace" : "Choose a photo"}</span>
                  <input type="file" accept="image/*" hidden onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPreview(await fileToCompressedDataUrl(file));
                  }} />
                  {preview && <img src={preview} alt="" className="f-file-preview" />}
                </label>
              </div>
              <div className="field-block">
                <label className="field-label">Caption</label>
                <textarea className="f-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A line about the moment" />
              </div>
            </div>
            {error && <p className="error-note">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={!preview || busy} onClick={submit}>
              {busy ? <Loader2 className="spin" size={16} /> : "Share memory"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* =======================================================================
   ADMIN — EVENT EDITOR
======================================================================= */
function EventEditor({ initial, onSave, onCancel }) {
  const [ev, setEv] = useState(
    initial || {
      id: uid(), track: "science", title: "", description: "",
      date: "", time: "", location: "", fields: [], createdAt: Date.now(),
    }
  );

  const addField = (type) => {
    setEv((e) => ({
      ...e,
      fields: [
        ...e.fields,
        { id: uid(), type, label: "", required: false, options: type === "choice" ? ["Option 1"] : undefined },
      ],
    }));
  };
  const updateField = (id, patch) => {
    setEv((e) => ({ ...e, fields: e.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  };
  const removeField = (id) => setEv((e) => ({ ...e, fields: e.fields.filter((f) => f.id !== id) }));

  return (
    <div className="editor">
      <div className="editor-row">
        <div className="field-block">
          <label className="field-label">Track</label>
          <div className="f-options">
            {Object.entries(TRACKS).map(([key, t]) => (
              <button
                key={key}
                type="button"
                className={"f-option" + (ev.track === key ? " f-option-active" : "")}
                style={ev.track === key ? { borderColor: t.color, color: t.color } : {}}
                onClick={() => setEv((e) => ({ ...e, track: key }))}
              >
                <t.Icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="field-block">
        <label className="field-label">Event title</label>
        <input className="f-input single" value={ev.title} onChange={(e) => setEv((s) => ({ ...s, title: e.target.value }))} placeholder="e.g. Building Our First Nanobot Model" />
      </div>
      <div className="field-block">
        <label className="field-label">What's it about</label>
        <textarea className="f-input" rows={3} value={ev.description} onChange={(e) => setEv((s) => ({ ...s, description: e.target.value }))} placeholder="Why members should show up" />
      </div>
      <div className="editor-row three">
        <div className="field-block">
          <label className="field-label">Date</label>
          <input type="date" className="f-input single" value={ev.date} onChange={(e) => setEv((s) => ({ ...s, date: e.target.value }))} />
        </div>
        <div className="field-block">
          <label className="field-label">Time</label>
          <input type="time" className="f-input single" value={ev.time} onChange={(e) => setEv((s) => ({ ...s, time: e.target.value }))} />
        </div>
        <div className="field-block">
          <label className="field-label">Location</label>
          <input className="f-input single" value={ev.location} onChange={(e) => setEv((s) => ({ ...s, location: e.target.value }))} placeholder="Room / hall" />
        </div>
      </div>

      <div className="form-divider" />
      <h3 className="editor-subtitle">Formula (the form participants fill)</h3>
      {ev.fields.map((f) => (
        <div className="editor-field" key={f.id}>
          <div className="editor-field-row">
            <input
              className="f-input single grow"
              placeholder="Question label"
              value={f.label}
              onChange={(e) => updateField(f.id, { label: e.target.value })}
            />
            <span className="field-type-tag">{f.type}</span>
            <label className="req-toggle">
              <input type="checkbox" checked={f.required} onChange={(e) => updateField(f.id, { required: e.target.checked })} />
              required
            </label>
            <button className="icon-btn danger" onClick={() => removeField(f.id)}><Trash2 size={15} /></button>
          </div>
          {f.type === "choice" && (
            <div className="options-editor">
              {(f.options || []).map((opt, idx) => (
                <div key={idx} className="option-edit-row">
                  <input
                    className="f-input single"
                    value={opt}
                    onChange={(e) => {
                      const opts = [...f.options];
                      opts[idx] = e.target.value;
                      updateField(f.id, { options: opts });
                    }}
                  />
                  <button className="icon-btn danger" onClick={() => updateField(f.id, { options: f.options.filter((_, i) => i !== idx) })}><X size={14} /></button>
                </div>
              ))}
              <button className="link-btn" onClick={() => updateField(f.id, { options: [...(f.options || []), `Option ${(f.options || []).length + 1}`] })}>
                <Plus size={13} /> add option
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="add-field-row">
        <button className="btn btn-ghost" onClick={() => addField("text")}><Plus size={14} /> Text question</button>
        <button className="btn btn-ghost" onClick={() => addField("choice")}><Plus size={14} /> Multiple choice</button>
        <button className="btn btn-ghost" onClick={() => addField("file")}><Plus size={14} /> Photo upload</button>
      </div>

      <div className="form-divider" />
      <div className="editor-actions">
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!ev.title.trim()} onClick={() => onSave(ev)}>Save event</button>
      </div>
    </div>
  );
}

/* =======================================================================
   ADMIN — RESPONSES VIEWER
======================================================================= */
function ResponsesViewer({ event }) {
  const [responses, setResponses] = useState(null);

  useEffect(() => {
    (async () => setResponses((await storeGet(`responses:${event.id}`)) || []))();
  }, [event.id]);

  if (responses === null) return <p className="empty-note">Loading responses…</p>;
  if (responses.length === 0) return <p className="empty-note">No submissions yet for "{event.title}".</p>;

  return (
    <div className="responses-list">
      {responses.map((r) => (
        <div className="response-card" key={r.id}>
          <div className="response-date">{new Date(r.submittedAt).toLocaleString()}</div>
          {(event.fields || []).map((f) => (
            <div className="response-line" key={f.id}>
              <span className="response-label">{f.label}</span>
              {f.type === "file" && r.answers[f.id] ? (
                <img src={r.answers[f.id]} alt="" className="response-image" />
              ) : (
                <span className="response-value">{r.answers[f.id] || "—"}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* =======================================================================
   ADMIN DASHBOARD
======================================================================= */
function AdminDashboard() {
  const [tab, setTab] = useState("events");
  const [about, setAbout] = useState("");
  const [events, setEvents] = useState([]);
  const [memories, setMemories] = useState([]);
  const [pending, setPending] = useState([]);
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewingResponses, setViewingResponses] = useState(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const loadAll = useCallback(async () => {
    const [a, e, m, p] = await Promise.all([
      storeGet("about"),
      storeGet("events"),
      storeGet("memories"),
      storeGet("memoriesPending"),
    ]);
    setAbout(a?.text ?? SEED_ABOUT);
    setEvents(e || SEED_EVENTS);
    setMemories(m || []);
    setPending(p || []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const [saveError, setSaveError] = useState("");

  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };
  const fail = (msg) => setSaveError(msg);

  const saveAbout = async () => {
    setSaveError("");
    const ok = await storeSet("about", { text: about });
    if (ok) flash(); else fail("Couldn't save — check your internet connection and Firebase setup.");
  };

  const saveEvent = async (ev) => {
    setSaveError("");
    const exists = events.some((e) => e.id === ev.id);
    const next = exists ? events.map((e) => (e.id === ev.id ? ev : e)) : [...events, ev];
    const ok = await storeSet("events", next);
    if (ok) {
      setEvents(next);
      setEditingEvent(null);
      flash();
    } else {
      fail("Couldn't save this event — check your internet connection and Firebase setup. Your edits are still open below, try again.");
    }
  };
  const deleteEvent = async (id) => {
    setSaveError("");
    const next = events.filter((e) => e.id !== id);
    const ok = await storeSet("events", next);
    if (ok) setEvents(next); else fail("Couldn't delete — check your internet connection and Firebase setup.");
  };

  const approveMemory = async (item) => {
    setSaveError("");
    const next = [...memories];
    const group = next.find((m) => m.eventId === item.eventId);
    if (group) group.images = [...(group.images || []), item.image];
    else next.push({ id: uid(), eventId: item.eventId, eventTitle: item.eventTitle, images: [item.image] });
    const nextPending = pending.filter((p) => p.id !== item.id);
    const ok1 = await storeSet("memories", next);
    const ok2 = await storeSet("memoriesPending", nextPending);
    if (ok1 && ok2) { setMemories(next); setPending(nextPending); }
    else fail("Couldn't approve this photo — check your internet connection and Firebase setup.");
  };
  const rejectMemory = async (item) => {
    setSaveError("");
    const nextPending = pending.filter((p) => p.id !== item.id);
    const ok = await storeSet("memoriesPending", nextPending);
    if (ok) setPending(nextPending); else fail("Couldn't remove this photo — check your internet connection and Firebase setup.");
  };

  const addAdminMemory = async (eventId, eventTitle, images) => {
    setSaveError("");
    const next = [...memories];
    const group = next.find((m) => m.eventId === eventId);
    if (group) group.images = [...(group.images || []), ...images];
    else next.push({ id: uid(), eventId, eventTitle, images });
    const ok = await storeSet("memories", next);
    if (ok) { setMemories(next); setUploadingFor(null); }
    else fail("Couldn't upload — check your internet connection and Firebase setup.");
  };

  return (
    <div className="page admin-page">
      <ConnectionBanner />
      <div className="admin-topbar">
        <div className="nav-brand">
          <AtomMark size={30} />
          <div>
            <div className="brand-name">SCALE UP <span className="grad">NANO</span></div>
            <div className="brand-sub">ADMIN CONSOLE</div>
          </div>
        </div>
        <div className="admin-badge"><ShieldCheck size={14} /> private link — don't share</div>
      </div>

      <div className="admin-tabs">
        {["events", "about", "memories"].map((t) => (
          <button key={t} className={"admin-tab" + (tab === t ? " admin-tab-active" : "")} onClick={() => setTab(t)}>
            {t === "events" ? "Events & formulas" : t === "about" ? "About us" : "Memories"}
          </button>
        ))}
        {savedFlash && <span className="saved-flash"><Check size={13} /> saved</span>}
      </div>
      {saveError && <div className="admin-error-banner">{saveError}</div>}

      {tab === "about" && (
        <section className="section">
          <p className="empty-note">This text shows on the public "About us" section.</p>
          <textarea className="f-input" rows={6} value={about} onChange={(e) => setAbout(e.target.value)} />
          <button className="btn btn-primary" onClick={saveAbout}>Save about us</button>
        </section>
      )}

      {tab === "events" && (
        <section className="section">
          {editingEvent ? (
            <EventEditor
              initial={editingEvent === "new" ? null : editingEvent}
              onSave={saveEvent}
              onCancel={() => setEditingEvent(null)}
            />
          ) : viewingResponses ? (
            <div>
              <button className="link-btn back-btn" onClick={() => setViewingResponses(null)}>← back to events</button>
              <h3 className="editor-subtitle">Responses — {viewingResponses.title}</h3>
              <ResponsesViewer event={viewingResponses} />
            </div>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => setEditingEvent("new")}><Plus size={15} /> New event post</button>
              <div className="admin-event-list">
                {events.map((ev) => {
                  const track = TRACKS[ev.track] || TRACKS.science;
                  return (
                    <div className="admin-event-row" key={ev.id} style={{ "--accent": track.color }}>
                      <div>
                        <div className="event-track" style={{ color: track.color }}><track.Icon size={13} /> {track.label}</div>
                        <div className="admin-event-title">{ev.title}</div>
                        <div className="meta-row small"><span><Calendar size={13} /> {ev.date || "TBA"}</span><span><Clock size={13} /> {ev.time || "TBA"}</span></div>
                      </div>
                      <div className="admin-event-actions">
                        <button className="icon-btn" onClick={() => setViewingResponses(ev)} title="View responses"><ImageIcon size={15} /></button>
                        <button className="icon-btn" onClick={() => setEditingEvent(ev)} title="Edit"><Pencil size={15} /></button>
                        <button className="icon-btn danger" onClick={() => deleteEvent(ev.id)} title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "memories" && (
        <section className="section">
          <h3 className="editor-subtitle">Pending — submitted by participants</h3>
          {pending.length === 0 && <p className="empty-note">Nothing waiting for approval.</p>}
          <div className="pending-grid">
            {pending.map((p) => (
              <div className="pending-card" key={p.id}>
                <img src={p.image} alt="" />
                <div className="pending-meta">
                  <div className="pending-event">{p.eventTitle}</div>
                  {p.name && <div className="pending-name">by {p.name}</div>}
                  {p.note && <div className="pending-note">"{p.note}"</div>}
                </div>
                <div className="pending-actions">
                  <button className="icon-btn" onClick={() => approveMemory(p)}><Check size={15} /></button>
                  <button className="icon-btn danger" onClick={() => rejectMemory(p)}><X size={15} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="form-divider" />
          <h3 className="editor-subtitle">Post official photos</h3>
          <div className="admin-event-list">
            {events.map((ev) => (
              <div className="admin-event-row" key={ev.id}>
                <div className="admin-event-title">{ev.title}</div>
                <label className="btn btn-ghost as-label">
                  <Upload size={14} /> upload
                  <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    const imgs = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
                    addAdminMemory(ev.id, ev.title, imgs);
                  }} />
                </label>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* =======================================================================
   ROOT — routes on #aymen
======================================================================= */
export default function ScaleUpNano() {
  const ADMIN_HASH = "#aymen";
  const [isAdmin, setIsAdmin] = useState(window.location.hash === ADMIN_HASH);

  useEffect(() => {
    const onHash = () => setIsAdmin(window.location.hash === ADMIN_HASH);
    window.addEventListener("hashchange", onHash);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <style>{CSS}</style>
      {isAdmin ? <AdminDashboard /> : <PublicSite />}
    </>
  );
}

/* =======================================================================
   CSS
======================================================================= */
const CSS = `
* { box-sizing: border-box; }
:root {
  --void: #06060c;
  --panel: #0d0d18;
  --violet: #8b5cf6;
  --magenta: #d946ef;
  --cyan: #22d3ee;
  --mist: #b9bad8;
  --white: #f5f4fb;
}
body { margin: 0; }
.page {
  background: radial-gradient(ellipse at 50% -10%, #1b1330 0%, var(--void) 55%);
  color: var(--white);
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  overflow-x: hidden;
}
.grad {
  background: linear-gradient(90deg, var(--violet), var(--cyan));
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

/* atom */
.atom-mark { position: relative; margin: 0 auto; }
.orbit { position: absolute; inset: 0; border-radius: 50%; border: 2px solid; filter: drop-shadow(0 0 6px currentColor); }
.orbit-a { border-color: var(--magenta); transform: rotate(0deg) scaleY(0.42); animation: spin 9s linear infinite; }
.orbit-b { border-color: var(--cyan); transform: rotate(60deg) scaleY(0.42); animation: spin 7s linear infinite reverse; }
.orbit-c { border-color: var(--violet); transform: rotate(-60deg) scaleY(0.42); animation: spin 11s linear infinite; }
.nucleus {
  position: absolute; top: 50%; left: 50%; width: 22%; height: 22%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle at 35% 35%, #fff, var(--magenta) 60%, var(--violet) 100%);
  border-radius: 50%; box-shadow: 0 0 20px var(--magenta), 0 0 40px var(--violet);
  animation: pulse 2.6s ease-in-out infinite;
}
@keyframes spin { to { transform: rotate(360deg) scaleY(0.42); } }
@keyframes pulse { 0%,100% { transform: translate(-50%,-50%) scale(1);} 50% { transform: translate(-50%,-50%) scale(1.08);} }
@media (prefers-reduced-motion: reduce) { .orbit, .nucleus { animation: none; } }

/* nav */
.nav { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; position: sticky; top: 0; backdrop-filter: blur(10px); background: rgba(6,6,12,0.7); z-index: 20; border-bottom: 1px solid rgba(255,255,255,0.06); }
.nav-brand { display: flex; align-items: center; gap: 10px; }
.brand-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: 0.03em; font-size: 15px; }
.brand-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.3em; color: var(--mist); }
.nav-burger { display: none; background: none; border: none; color: var(--white); }
.nav-links { display: flex; gap: 22px; }
.nav-links a { color: var(--mist); text-decoration: none; font-size: 14px; font-weight: 500; }
.nav-links a:hover { color: var(--white); }
@media (max-width: 640px) {
  .nav-burger { display: block; }
  .nav-links { position: absolute; top: 64px; right: 0; left: 0; background: var(--panel); flex-direction: column; padding: 16px 24px; display: none; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .nav-links-open { display: flex; }
}

/* hero */
.hero { text-align: center; padding: 64px 20px 40px; }
.hero-title { font-family: 'Space Grotesk', sans-serif; font-size: clamp(28px, 6vw, 48px); font-weight: 700; letter-spacing: 0.01em; margin: 24px 0 12px; }
.hero-sub { color: var(--mist); max-width: 460px; margin: 0 auto 26px; line-height: 1.6; }

/* buttons */
.btn { font-family: 'Inter', sans-serif; border: none; border-radius: 999px; padding: 12px 22px; font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: transform .15s ease, opacity .15s ease; }
.btn:hover { transform: translateY(-1px); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.btn-primary { background: linear-gradient(90deg, var(--violet), var(--cyan)); color: #08060f; }
.btn-secondary { background: rgba(255,255,255,0.08); color: var(--white); }
.btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: var(--mist); }
.btn-block { width: 100%; justify-content: center; margin-top: 16px; }
.as-label { cursor: pointer; }
.spin { animation: spin 1s linear infinite; }

/* sections */
.section { max-width: 1000px; margin: 0 auto; padding: 48px 24px; }
.section-title { font-family: 'Space Grotesk', sans-serif; display: flex; align-items: center; gap: 8px; font-size: 20px; margin-bottom: 18px; color: var(--white); }
.muted-title { margin-top: 40px; color: var(--mist); font-size: 16px; }
.about-text { color: var(--mist); line-height: 1.75; font-size: 15px; max-width: 640px; }
.empty-note { color: #7c7d99; font-size: 14px; font-style: italic; }

/* event cards */
.event-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.event-card { background: var(--panel); border: 1px solid rgba(255,255,255,0.07); border-left: 3px solid var(--accent); border-radius: 14px; padding: 20px; cursor: pointer; transition: transform .15s ease, border-color .15s ease; }
.event-card:hover { transform: translateY(-3px); border-color: var(--accent); }
.event-card.past { cursor: default; opacity: 0.85; }
.event-track { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.event-title { font-family: 'Space Grotesk', sans-serif; font-size: 17px; margin: 0 0 8px; line-height: 1.35; }
.event-desc { color: var(--mist); font-size: 13.5px; line-height: 1.55; margin-bottom: 14px; }
.meta-row { display: flex; gap: 16px; flex-wrap: wrap; color: var(--mist); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.meta-row.small span { display: inline-flex; align-items: center; gap: 4px; }
.meta-row span { display: inline-flex; align-items: center; gap: 5px; }
.event-cta { margin-top: 14px; font-size: 13px; font-weight: 600; color: var(--cyan); display: inline-flex; align-items: center; gap: 4px; }
.event-cta.as-button { background: none; border: none; cursor: pointer; }

/* memories */
.memory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.memory-tile { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 1; }
.memory-tile img { width: 100%; height: 100%; object-fit: cover; }
.memory-caption { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding: 18px 8px 6px; font-size: 11px; color: var(--mist); }

/* footer */
.footer { text-align: center; padding: 50px 20px 60px; }
.footer-follow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.25em; color: var(--cyan); margin-bottom: 8px; }
.footer-handle { font-weight: 700; font-size: 16px; margin-bottom: 6px; }
.footer-note { color: #6d6e88; font-size: 11px; letter-spacing: 0.15em; }

/* modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(3,3,8,0.75); backdrop-filter: blur(4px); display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; z-index: 100; }
.modal { background: var(--panel); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 28px; max-width: 520px; width: 100%; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.modal-close { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.06); border: none; color: var(--white); border-radius: 50%; width: 32px; height: 32px; cursor: pointer; }
.modal-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.modal-title { font-family: 'Space Grotesk', sans-serif; font-size: 21px; margin: 0 0 10px; padding-right: 30px; }
.modal-desc { color: var(--mist); font-size: 14px; line-height: 1.6; margin-bottom: 16px; }
.form-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 18px 0; }
.done-state { text-align: center; padding: 20px 0; color: var(--cyan); display: flex; flex-direction: column; align-items: center; gap: 10px; }
.error-note { color: #ff9db3; font-size: 13px; margin: 4px 0 0; }
.conn-banner { background: rgba(217,70,239,0.12); border-bottom: 1px solid rgba(217,70,239,0.4); color: #ffd6f6; font-size: 13px; padding: 12px 20px; text-align: center; line-height: 1.6; }
.conn-banner code { background: rgba(255,255,255,0.1); padding: 1px 6px; border-radius: 5px; }
.conn-banner-detail { font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.75; margin-top: 4px; }
.admin-error-banner { margin: 12px 24px 0; background: rgba(217,70,239,0.12); border: 1px solid rgba(217,70,239,0.4); color: #ffd6f6; font-size: 13px; padding: 10px 14px; border-radius: 10px; }

/* fields */
.field-block { margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--white); }
.req { color: var(--magenta); }
.f-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 12px; color: var(--white); font-family: 'Inter'; font-size: 14px; resize: vertical; }
.f-input.single { resize: none; }
.f-input.grow { flex: 1; }
.f-input:focus, .f-option:focus, .btn:focus { outline: 2px solid var(--cyan); outline-offset: 1px; }
.f-options { display: flex; flex-wrap: wrap; gap: 8px; }
.f-option { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: var(--mist); border-radius: 999px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
.f-option-active { border-color: var(--cyan); color: var(--cyan); background: rgba(34,211,238,0.08); }
.f-file { display: flex; align-items: center; gap: 8px; border: 1px dashed rgba(255,255,255,0.2); border-radius: 10px; padding: 12px; font-size: 13px; color: var(--mist); cursor: pointer; }
.f-file-preview { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; margin-left: auto; }

/* admin */
.admin-page { padding-bottom: 60px; }
.admin-topbar { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-wrap: wrap; gap: 10px; }
.admin-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--magenta); display: flex; align-items: center; gap: 5px; border: 1px solid rgba(217,70,239,0.3); padding: 5px 10px; border-radius: 999px; }
.admin-tabs { display: flex; gap: 6px; padding: 16px 24px 0; align-items: center; }
.admin-tab { background: transparent; border: none; color: var(--mist); padding: 10px 16px; border-radius: 10px 10px 0 0; cursor: pointer; font-size: 13px; font-weight: 600; }
.admin-tab-active { background: var(--panel); color: var(--white); }
.saved-flash { margin-left: auto; color: #34d8a3; font-size: 12px; display: flex; align-items: center; gap: 4px; }
.editor-subtitle { font-family: 'Space Grotesk', sans-serif; font-size: 15px; margin: 18px 0 10px; }
.editor-row { display: flex; gap: 14px; margin-bottom: 6px; }
.editor-row.three > div { flex: 1; }
.editor-field { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.editor-field-row { display: flex; align-items: center; gap: 8px; }
.field-type-tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--mist); background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
.req-toggle { font-size: 11px; color: var(--mist); display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.icon-btn { background: rgba(255,255,255,0.06); border: none; color: var(--white); width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.icon-btn.danger:hover { background: rgba(217,70,239,0.2); color: var(--magenta); }
.options-editor { margin-top: 10px; padding-left: 4px; }
.option-edit-row { display: flex; gap: 8px; margin-bottom: 6px; }
.link-btn { background: none; border: none; color: var(--cyan); font-size: 12.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; padding: 0; }
.back-btn { margin-bottom: 12px; }
.add-field-row { display: flex; gap: 10px; flex-wrap: wrap; margin: 12px 0 20px; }
.editor-actions { display: flex; gap: 10px; justify-content: flex-end; }
.admin-event-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.admin-event-row { display: flex; justify-content: space-between; align-items: center; background: var(--panel); border-left: 3px solid var(--accent, var(--violet)); border-radius: 10px; padding: 14px 16px; gap: 12px; flex-wrap: wrap; }
.admin-event-title { font-weight: 600; font-size: 14px; margin: 4px 0; }
.admin-event-actions { display: flex; gap: 6px; }
.responses-list { display: flex; flex-direction: column; gap: 12px; }
.response-card { background: var(--panel); border-radius: 10px; padding: 14px; border: 1px solid rgba(255,255,255,0.06); }
.response-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--mist); margin-bottom: 8px; }
.response-line { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); font-size: 13px; }
.response-label { color: var(--mist); }
.response-image { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; }
.pending-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 14px; }
.pending-card { background: var(--panel); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); }
.pending-card img { width: 100%; height: 130px; object-fit: cover; }
.pending-meta { padding: 10px 12px 4px; font-size: 12.5px; }
.pending-event { font-weight: 600; }
.pending-name, .pending-note { color: var(--mist); margin-top: 2px; }
.pending-actions { display: flex; gap: 8px; padding: 8px 12px 12px; }
`;
