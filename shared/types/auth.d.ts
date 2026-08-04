export type TrackFitRole = 'admin' | 'viewer'

declare module '#auth-utils' {
  interface User {
    username: string
    role: TrackFitRole
  }
}

export {}
