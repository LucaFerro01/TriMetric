import { pgTable, uuid, varchar, real, date, integer, timestamp, jsonb, text, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }),
  weight: real('weight'), // kg
  height: real('height'), // cm
  birthDate: date('birth_date'),
  stravaId: varchar('strava_id', { length: 100 }).unique(),
  stravaAccessToken: text('strava_access_token'),
  stravaRefreshToken: text('strava_refresh_token'),
  stravaTokenExpiresAt: integer('strava_token_expires_at'),
  zeppToken: text('zepp_token'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  externalId: varchar('external_id', { length: 255 }),
  source: varchar('source', { length: 50 }).notNull(), // 'strava', 'zepp', 'fit', 'gpx'
  activityType: varchar('activity_type', { length: 100 }).notNull(), // 'run', 'ride', 'swim', etc.
  name: varchar('name', { length: 500 }),
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  duration: integer('duration'), // seconds
  distance: real('distance'), // meters
  elevationGain: real('elevation_gain'), // meters
  avgHeartRate: integer('avg_heart_rate'), // bpm
  maxHeartRate: integer('max_heart_rate'), // bpm
  avgPower: integer('avg_power'), // watts
  maxPower: integer('max_power'), // watts
  avgSpeed: real('avg_speed'), // m/s
  maxSpeed: real('max_speed'), // m/s
  calories: integer('calories'),
  avgCadence: integer('avg_cadence'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('activities_user_id_idx').on(table.userId),
  startTimeIdx: index('activities_start_time_idx').on(table.startTime),
  sourceIdx: index('activities_source_idx').on(table.source),
  externalIdIdx: index('activities_external_id_idx').on(table.externalId),
}));

export const metrics = pgTable('metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  vo2max: real('vo2max'),
  ftp: integer('ftp'), // watts
  totalCalories: integer('total_calories'),
  totalDistance: real('total_distance'), // meters
  totalDuration: integer('total_duration'), // seconds
  tdee: integer('tdee'), // kcal/day
  weight: real('weight'), // kg for that day
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index('metrics_user_date_idx').on(table.userId, table.date),
}));

export const streamData = pgTable('stream_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  time: jsonb('time'), // array of timestamps
  heartrate: jsonb('heartrate'),
  power: jsonb('power'),
  cadence: jsonb('cadence'),
  velocity: jsonb('velocity'),
  altitude: jsonb('altitude'),
  latlng: jsonb('latlng'),
});

export const scheduledWorkouts = pgTable('scheduled_workouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  discipline: varchar('discipline', { length: 50 }).notNull(), // 'run', 'bike', 'swim'
  workoutType: varchar('workout_type', { length: 100 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  scheduledDate: date('scheduled_date').notNull(),
  scheduledTime: varchar('scheduled_time', { length: 5 }), // HH:mm
  duration: integer('duration'), // minutes
  distance: real('distance'), // km
  intensity: varchar('intensity', { length: 50 }),
  status: varchar('status', { length: 30 }).default('planned').notNull(), // planned | completed | skipped
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  userDateIdx: index('scheduled_workouts_user_date_idx').on(table.userId, table.scheduledDate),
  disciplineIdx: index('scheduled_workouts_discipline_idx').on(table.discipline),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  activities: many(activities),
  metrics: many(metrics),
  scheduledWorkouts: many(scheduledWorkouts),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  streamData: one(streamData, { fields: [activities.id], references: [streamData.activityId] }),
}));

export const metricsRelations = relations(metrics, ({ one }) => ({
  user: one(users, { fields: [metrics.userId], references: [users.id] }),
}));

export const scheduledWorkoutsRelations = relations(scheduledWorkouts, ({ one }) => ({
  user: one(users, { fields: [scheduledWorkouts.userId], references: [users.id] }),
}));
