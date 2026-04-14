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
  createScheduledWorkout,
  deleteScheduledWorkout,
  getScheduledWorkouts,
  type CreateScheduledWorkout,
  type Discipline,
  type ScheduledWorkout,
  type WorkoutStatus,
  updateScheduledWorkout,
} from '../api/scheduling';

type WorkoutTemplate = {
  value: string;
  label: string;
  description: string;
  intensity: string;
};

const templatesByDiscipline: Record<Discipline, WorkoutTemplate[]> = {
  run: [
    {
      value: 'easy-run-z2',
      label: 'Easy Run (Z1-Z2)',
      description: '45-60 min corsa facile per aumentare volume aerobico e favorire recupero.',
      intensity: 'Bassa',
    },
    {
      value: 'long-run',
      label: 'Long Run',
      description: '80-120 min a ritmo conversazionale per resistenza specifica.',
      intensity: 'Media',
    },
    {
      value: 'vo2-intervals',
      label: 'VO2 Intervals',
      description: '5-6 x 3 min ad alta intensita con 2 min recupero jog.',
      intensity: 'Alta',
    },
  ],
  bike: [
    {
      value: 'endurance-z2',
      label: 'Endurance Ride (Z2)',
      description: '90-150 min in Z2 per base aerobica e tolleranza al volume.',
      intensity: 'Bassa',
    },
    {
      value: 'threshold-intervals',
      label: 'Threshold Intervals',
      description: '3 x 12 min a 95-100% FTP con 6 min recupero.',
      intensity: 'Alta',
    },
    {
      value: 'long-ride',
      label: 'Long Ride',
      description: '2.5-4 ore a ritmo endurance per stamina metabolica.',
      intensity: 'Media',
    },
  ],
  swim: [
    {
      value: 'technique-drills',
      label: 'Technique + Drills',
      description: 'Sessione tecnica con focus su efficienza, assetto e trazione.',
      intensity: 'Bassa',
    },
    {
      value: 'css-intervals',
      label: 'CSS Intervals',
      description: '10 x 100m a passo soglia nuoto con recuperi brevi controllati.',
      intensity: 'Alta',
    },
    {
      value: 'aerobic-endurance',
      label: 'Aerobic Endurance',
      description: 'Serie lunghe continue per costruire capacita aerobica nel nuoto.',
      intensity: 'Media',
    },
  ],
};

const statusClass: Record<WorkoutStatus, string> = {
  planned: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  skipped: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function Scheduling() {
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<ScheduledWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [discipline, setDiscipline] = useState<Discipline>('run');
  const [templateValue, setTemplateValue] = useState(templatesByDiscipline.run[0].value);
  const [scheduledTime, setScheduledTime] = useState('07:00');
  const [duration, setDuration] = useState<number>(60);
  const [distance, setDistance] = useState<number>(0);

  const visibleRange = useMemo(() => {
    const from = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const to = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return { from, to };
  }, [calendarMonth]);

  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: visibleRange.from, end: visibleRange.to }),
    [visibleRange]
  );

  const selectedTemplate = useMemo(
    () => templatesByDiscipline[discipline].find((t) => t.value === templateValue) ?? templatesByDiscipline[discipline][0],
    [discipline, templateValue]
  );

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
    setTemplateValue(templatesByDiscipline[discipline][0].value);
    setDuration(discipline === 'bike' ? 90 : discipline === 'swim' ? 50 : 60);
    setDistance(discipline === 'bike' ? 45 : discipline === 'swim' ? 2.2 : 10);
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

  async function handleCreateWorkout() {
    if (!selectedTemplate) return;

    const payload: CreateScheduledWorkout = {
      discipline,
      workoutType: selectedTemplate.label,
      title: `${selectedTemplate.label} - ${discipline.toUpperCase()}`,
      description: selectedTemplate.description,
      intensity: selectedTemplate.intensity,
      scheduledDate: selectedDateKey,
      scheduledTime,
      duration,
      distance,
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
                Tipo workout
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  value={templateValue}
                  onChange={(e) => setTemplateValue(e.target.value)}
                >
                  {templatesByDiscipline[discipline].map((template) => (
                    <option key={template.value} value={template.value}>
                      {template.label}
                    </option>
                  ))}
                </select>
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

            <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
              <div className="text-slate-300 text-sm font-medium">Template</div>
              <div className="text-slate-400 text-sm mt-1">{selectedTemplate.description}</div>
              <div className="text-slate-500 text-xs mt-2">Intensita: {selectedTemplate.intensity}</div>
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
