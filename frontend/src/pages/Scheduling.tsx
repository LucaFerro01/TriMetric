import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  createWorkoutTemplate,
  createScheduledWorkout,
  deleteWorkoutTemplate,
  deleteScheduledWorkout,
  getScheduledWorkouts,
  getWorkoutTemplates,
  type CreateScheduledWorkout,
  type Discipline,
  type ScheduledWorkout,
  type WorkoutStep,
  type WorkoutTemplate,
  type WorkoutStatus,
  updateScheduledWorkout,
} from '../api/scheduling';

type WorkoutTargetOption = {
  value: string;
  label: string;
  placeholder: string;
};

const targetOptionsByDiscipline: Record<Discipline, WorkoutTargetOption[]> = {
  run: [
    { value: 'pace_min_km', label: 'Ritmo (min/km)', placeholder: 'es. 4:45 /km' },
    { value: 'heart_rate_bpm', label: 'Frequenza cardiaca (bpm)', placeholder: 'es. 155 bpm' },
    { value: 'rpe', label: 'RPE', placeholder: 'es. 7/10' },
  ],
  bike: [
    { value: 'power_w', label: 'Potenza (W)', placeholder: 'es. 240 W' },
    { value: 'heart_rate_bpm', label: 'Frequenza cardiaca (bpm)', placeholder: 'es. 150 bpm' },
    { value: 'cadence_rpm', label: 'Cadenza (rpm)', placeholder: 'es. 90 rpm' },
    { value: 'speed_kmh', label: 'Velocita (km/h)', placeholder: 'es. 34 km/h' },
    { value: 'rpe', label: 'RPE', placeholder: 'es. 8/10' },
  ],
  swim: [
    { value: 'pace_100m', label: 'Passo /100m', placeholder: 'es. 1:42 /100m' },
    { value: 'heart_rate_bpm', label: 'Frequenza cardiaca (bpm)', placeholder: 'es. 145 bpm' },
    { value: 'swolf', label: 'SWOLF', placeholder: 'es. 38' },
    { value: 'stroke_rate_spm', label: 'Stroke rate (spm)', placeholder: 'es. 34 spm' },
    { value: 'rpe', label: 'RPE', placeholder: 'es. 6/10' },
  ],
};

const disciplineDefaults: Record<Discipline, { workoutType: string; duration: number; distance: number; intensity: string }> = {
  run: { workoutType: 'Corsa personalizzata', duration: 60, distance: 10, intensity: 'Media' },
  bike: { workoutType: 'Bici personalizzata', duration: 90, distance: 45, intensity: 'Media' },
  swim: { workoutType: 'Nuoto personalizzato', duration: 50, distance: 2.2, intensity: 'Media' },
};

const targetLabelByValue: Record<string, string> = {
  pace_min_km: 'Ritmo (min/km)',
  heart_rate_bpm: 'FC (bpm)',
  rpe: 'RPE',
  power_w: 'Potenza (W)',
  cadence_rpm: 'Cadenza (rpm)',
  speed_kmh: 'Velocita (km/h)',
  pace_100m: 'Passo /100m',
  swolf: 'SWOLF',
  stroke_rate_spm: 'Stroke rate (spm)',
};

const statusClass: Record<WorkoutStatus, string> = {
  planned: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  skipped: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function buildDefaultStep(discipline: Discipline): WorkoutStep {
  const targetOption = targetOptionsByDiscipline[discipline][0];
  return {
    name: 'Step 1',
    durationMinutes: 10,
    distance: null,
    distanceUnit: discipline === 'swim' ? 'm' : 'km',
    targetType: targetOption.value,
    targetValue: '',
    notes: null,
  };
}

function formatStepSummary(step: WorkoutStep): string {
  const parts: string[] = [step.name];
  if (step.durationMinutes != null && step.durationMinutes > 0) {
    parts.push(`${step.durationMinutes} min`);
  }
  if (step.distance != null && step.distance > 0) {
    parts.push(`${step.distance} ${step.distanceUnit ?? 'km'}`);
  }
  parts.push(`${targetLabelByValue[step.targetType] ?? step.targetType}: ${step.targetValue}`);
  return parts.join(' · ');
}

export default function Scheduling() {
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [discipline, setDiscipline] = useState<Discipline>('run');
  const [workoutType, setWorkoutType] = useState(disciplineDefaults.run.workoutType);
  const [templateDescription, setTemplateDescription] = useState('');
  const [intensity, setIntensity] = useState(disciplineDefaults.run.intensity);
  const [scheduledTime, setScheduledTime] = useState('07:00');
  const [duration, setDuration] = useState<number>(60);
  const [distance, setDistance] = useState<number>(0);
  const [steps, setSteps] = useState<WorkoutStep[]>([buildDefaultStep('run')]);

  const visibleRange = useMemo(() => {
    const from = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const to = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return { from, to };
  }, [calendarMonth]);

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: visibleRange.from, end: visibleRange.to }),
    [visibleRange]
  );

  const currentTargetOptions = useMemo(() => targetOptionsByDiscipline[discipline], [discipline]);

  const groupedByDate = useMemo(() => {
    return workouts.reduce<Record<string, ScheduledWorkout[]>>((acc, workout) => {
      if (!acc[workout.scheduledDate]) acc[workout.scheduledDate] = [];
      acc[workout.scheduledDate].push(workout);
      return acc;
    }, {});
  }, [workouts]);

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDayWorkouts = groupedByDate[selectedDateKey] ?? [];

  useEffect(() => {
    setWorkoutType(disciplineDefaults[discipline].workoutType);
    setTemplateDescription('');
    setIntensity(disciplineDefaults[discipline].intensity);
    setDuration(disciplineDefaults[discipline].duration);
    setDistance(disciplineDefaults[discipline].distance);
    setSteps([buildDefaultStep(discipline)]);
    setSelectedTemplateId('');
  }, [discipline]);

  useEffect(() => {
    setTemplatesLoading(true);
    getWorkoutTemplates(discipline)
      .then(setTemplates)
      .catch(console.error)
      .finally(() => setTemplatesLoading(false));
  }, [discipline]);

  useEffect(() => {
    const from = toDateKey(addDays(visibleRange.from, -14));
    const to = toDateKey(addDays(visibleRange.to, 14));

    setLoading(true);
    getScheduledWorkouts({ from, to })
      .then(setWorkouts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [visibleRange.from, visibleRange.to]);

  function updateStep(index: number, patch: Partial<WorkoutStep>) {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  function addStep() {
    setSteps((prev) => {
      const nextStep = buildDefaultStep(discipline);
      nextStep.name = `Step ${prev.length + 1}`;
      return [...prev, nextStep];
    });
  }

  function removeStep(index: number) {
    setSteps((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }

  function getTargetPlaceholder(targetType: string): string {
    return currentTargetOptions.find((option) => option.value === targetType)?.placeholder ?? 'Valore target';
  }

  function normalizeSteps(): WorkoutStep[] | null {
    const normalizedSteps = steps.map((step) => ({
      ...step,
      name: step.name.trim(),
      targetValue: step.targetValue.trim(),
      notes: step.notes?.trim() || null,
      durationMinutes: step.durationMinutes && step.durationMinutes > 0 ? step.durationMinutes : null,
      distance: step.distance && step.distance > 0 ? step.distance : null,
    }));

    const hasInvalidStep = normalizedSteps.some((step) => {
      const hasVolume = (step.durationMinutes ?? 0) > 0 || (step.distance ?? 0) > 0;
      return !step.name || !step.targetValue || !hasVolume;
    });

    if (hasInvalidStep) {
      alert('Ogni step richiede nome, target e almeno durata o distanza.');
      return null;
    }

    return normalizedSteps;
  }

  function handleApplyTemplate() {
    if (!selectedTemplateId) return;
    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;

    setWorkoutType(template.name);
    setTemplateDescription(template.description ?? '');
    setIntensity(template.intensity ?? disciplineDefaults[discipline].intensity);
    setDuration(template.duration ?? disciplineDefaults[discipline].duration);
    setDistance(template.distance ?? disciplineDefaults[discipline].distance);
    setSteps(template.workoutSteps && template.workoutSteps.length > 0 ? template.workoutSteps : [buildDefaultStep(discipline)]);
  }

  async function handleSaveTemplate() {
    const name = workoutType.trim();
    if (!name) {
      alert('Inserisci il nome del template da salvare.');
      return;
    }

    const normalizedSteps = normalizeSteps();
    if (!normalizedSteps) return;

    setSavingTemplate(true);
    try {
      const created = await createWorkoutTemplate({
        discipline,
        name,
        description: templateDescription.trim() || null,
        intensity: intensity.trim() || null,
        duration: duration > 0 ? duration : null,
        distance: distance > 0 ? distance : null,
        workoutSteps: normalizedSteps,
      });

      setTemplates((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTemplateId(created.id);
      alert('Template salvato nella libreria.');
    } catch (err) {
      console.error(err);
      alert('Errore durante il salvataggio del template.');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) return;

    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return;

    const confirmed = window.confirm(`Eliminare il template "${template.name}"?`);
    if (!confirmed) return;

    try {
      await deleteWorkoutTemplate(selectedTemplateId);
      setTemplates((prev) => prev.filter((item) => item.id !== selectedTemplateId));
      setSelectedTemplateId('');
    } catch (err) {
      console.error(err);
      alert('Errore durante eliminazione del template.');
    }
  }

  async function handleCreateWorkout() {
    const workoutTypeTrimmed = workoutType.trim();
    if (!workoutTypeTrimmed) {
      alert('Inserisci un nome per il workout/template.');
      return;
    }

    const normalizedSteps = normalizeSteps();
    if (!normalizedSteps) return;

    const payload: CreateScheduledWorkout = {
      discipline,
      workoutType: workoutTypeTrimmed,
      title: workoutTypeTrimmed,
      description: templateDescription.trim() || null,
      workoutSteps: normalizedSteps,
      intensity: intensity.trim() || null,
      scheduledDate: selectedDateKey,
      scheduledTime: scheduledTime || null,
      duration: duration > 0 ? duration : null,
      distance: distance > 0 ? distance : null,
      status: 'planned',
    };

    setSaving(true);
    try {
      const created = await createScheduledWorkout(payload);
      setWorkouts((prev) => [...prev, created]);
    } catch (err) {
      console.error(err);
      alert('Errore durante la creazione dell\'allenamento.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: WorkoutStatus) {
    try {
      const updated = await updateScheduledWorkout(id, { status });
      setWorkouts((prev) => prev.map((workout) => (workout.id === id ? updated : workout)));
    } catch (err) {
      console.error(err);
      alert('Errore durante aggiornamento stato.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteScheduledWorkout(id);
      setWorkouts((prev) => prev.filter((workout) => workout.id !== id));
    } catch (err) {
      console.error(err);
      alert('Errore durante eliminazione.');
    }
  }

  if (loading) {
    return <div className="md:ml-56 animate-pulse text-slate-400 p-8">Loading scheduling...</div>;
  }

  return (
    <div className="space-y-6 md:ml-56">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Scheduling</h1>
          <p className="text-slate-400 text-sm mt-1">Pianifica i prossimi allenamenti per corsa, bici e nuoto su calendario.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCalendarMonth((prev) => subMonths(prev, 1))}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setCalendarMonth(startOfMonth(new Date()))}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Oggi
          </button>
          <button
            type="button"
            onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="text-slate-200 font-medium mb-3">{format(calendarMonth, 'MMMM yyyy')}</div>
          <div className="grid grid-cols-7 text-xs text-slate-400 mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
              <div key={label} className="px-2 py-1">{label}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const dayKey = toDateKey(day);
              const dayWorkouts = groupedByDate[dayKey] ?? [];
              const isSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-24 rounded-lg border p-2 text-left transition ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                  } ${isSameMonth(day, calendarMonth) ? 'text-slate-100' : 'text-slate-500'}`}
                >
                  <div className="text-xs mb-1">{format(day, 'd')}</div>
                  <div className="space-y-1">
                    {dayWorkouts.slice(0, 2).map((workout) => (
                      <div key={workout.id} className={`rounded px-1.5 py-0.5 text-[10px] ${statusClass[workout.status]}`}>
                        {workout.discipline.toUpperCase()} · {workout.workoutType}
                      </div>
                    ))}
                    {dayWorkouts.length > 2 && (
                      <div className="text-[10px] text-slate-400">+{dayWorkouts.length - 2} altri</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
            <div>
              <h2 className="text-slate-200 font-medium">Nuovo workout</h2>
              <p className="text-slate-500 text-sm">Data selezionata: {format(selectedDate, 'EEE d MMM yyyy')}</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 space-y-2">
                <div className="text-sm text-slate-300 font-medium">Libreria template ({discipline.toUpperCase()})</div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 disabled:opacity-60"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={templatesLoading}
                  >
                    <option value="">{templatesLoading ? 'Caricamento template...' : 'Seleziona template salvato'}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleApplyTemplate}
                    disabled={!selectedTemplateId}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  >
                    Applica
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    disabled={!selectedTemplateId}
                    className="rounded-lg border border-rose-700 px-3 py-2 text-xs text-rose-300 hover:border-rose-500 disabled:opacity-60"
                  >
                    Elimina
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-300 hover:border-emerald-500 disabled:opacity-60"
                >
                  {savingTemplate ? 'Salvataggio template...' : 'Salva configurazione corrente in libreria'}
                </button>
              </div>

              <label className="text-sm text-slate-300">
                Disciplina
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as Discipline)}
                >
                  <option value="run">Corsa</option>
                  <option value="bike">Bici</option>
                  <option value="swim">Nuoto</option>
                </select>
              </label>

              <label className="text-sm text-slate-300">
                Nome workout/template
                <input
                  type="text"
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  placeholder="es. Ripetute soglia 6x1km"
                />
              </label>

              <label className="text-sm text-slate-300">
                Descrizione template
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  placeholder="Obiettivo della seduta, focus tecnico, recuperi..."
                />
              </label>

              <label className="text-sm text-slate-300">
                Intensita (facoltativa)
                <input
                  type="text"
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  placeholder="es. Media / Z3 / RPE 7"
                />
              </label>

              <label className="text-sm text-slate-300">
                Orario
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-300">
                  Durata (min)
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </label>
                <label className="text-sm text-slate-300">
                  Distanza (km)
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={distance}
                    onChange={(e) => setDistance(Number(e.target.value) || 0)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-slate-300 text-sm font-medium">Intervalli / Step</div>
                <button
                  type="button"
                  onClick={addStep}
                  className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
                >
                  + Aggiungi step
                </button>
              </div>

              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={`step-${index}`} className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">Step {index + 1}</div>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          Rimuovi
                        </button>
                      )}
                    </div>

                    <label className="text-xs text-slate-300 block">
                      Nome step
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(index, { name: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                        placeholder="es. Ripetuta 1"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-300">
                        Durata (min)
                        <input
                          type="number"
                          min={0}
                          value={step.durationMinutes ?? ''}
                          onChange={(e) => updateStep(index, { durationMinutes: Number(e.target.value) || null })}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                        />
                      </label>

                      <div className="grid grid-cols-[1fr_90px] gap-2">
                        <label className="text-xs text-slate-300">
                          Distanza
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={step.distance ?? ''}
                            onChange={(e) => updateStep(index, { distance: Number(e.target.value) || null })}
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                          />
                        </label>
                        <label className="text-xs text-slate-300">
                          Unita
                          <select
                            value={step.distanceUnit ?? 'km'}
                            onChange={(e) => updateStep(index, { distanceUnit: e.target.value as 'km' | 'm' })}
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                          >
                            <option value="km">km</option>
                            <option value="m">m</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-300">
                        Metodo target
                        <select
                          value={step.targetType}
                          onChange={(e) => updateStep(index, { targetType: e.target.value, targetValue: '' })}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                        >
                          {currentTargetOptions.map((targetOption) => (
                            <option key={targetOption.value} value={targetOption.value}>
                              {targetOption.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs text-slate-300">
                        Valore target
                        <input
                          type="text"
                          value={step.targetValue}
                          onChange={(e) => updateStep(index, { targetValue: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                          placeholder={getTargetPlaceholder(step.targetType)}
                        />
                      </label>
                    </div>

                    <label className="text-xs text-slate-300 block">
                      Note step (facoltative)
                      <input
                        type="text"
                        value={step.notes ?? ''}
                        onChange={(e) => updateStep(index, { notes: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-100"
                        placeholder="es. Recupero 90 sec jogging"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateWorkout}
              disabled={saving}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 font-medium text-slate-950 hover:bg-orange-400 disabled:opacity-60"
            >
              {saving ? 'Salvataggio...' : 'Aggiungi al calendario'}
            </button>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <h2 className="text-slate-200 font-medium mb-3">Allenamenti del giorno</h2>
            {selectedDayWorkouts.length === 0 && (
              <div className="text-slate-500 text-sm">Nessun allenamento pianificato.</div>
            )}
            <div className="space-y-3">
              {selectedDayWorkouts.map((workout) => (
                <div key={workout.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-slate-100 font-medium">{workout.title}</div>
                      <div className="text-slate-500 text-xs mt-1">
                        {workout.scheduledTime || '--:--'} · {workout.duration || '-'} min · {workout.distance || '-'} km
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(workout.id)}
                      className="text-xs text-rose-400 hover:text-rose-300"
                    >
                      Elimina
                    </button>
                  </div>
                  <div className="text-slate-400 text-sm mt-2">{workout.description}</div>
                  {workout.workoutSteps && workout.workoutSteps.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {workout.workoutSteps.slice(0, 4).map((step, index) => (
                        <div key={`${workout.id}-step-${index}`} className="text-xs text-slate-500">
                          {formatStepSummary(step)}
                        </div>
                      ))}
                      {workout.workoutSteps.length > 4 && (
                        <div className="text-xs text-slate-500">+{workout.workoutSteps.length - 4} step aggiuntivi</div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full px-2 py-1 text-xs ${statusClass[workout.status]}`}>{workout.status}</span>
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      value={workout.status}
                      onChange={(e) => handleStatusChange(workout.id, e.target.value as WorkoutStatus)}
                    >
                      <option value="planned">Planned</option>
                      <option value="completed">Completed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
