export type UserRole = 'admin' | 'hod' | 'teacher';

export interface Course {
  _id: string;
  name: string;
  code: string;
  durationYears: number;
  createdAt?: string;
}

export interface Department {
  _id: string;
  name: string;
  code: string;
  course?: Course | any;
  createdAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: Department | any;
  course?: Course | any;
  year?: number; // 1, 2, 3, 4 (legacy/optional)
  employeeId?: string;
  phone?: string;
  teachingYears?: number[];
  currentlyTeachingYears?: number[];
  assignedBatches?: (Batch | any)[];
  batches?: (Batch | any)[];
  isActive: boolean;
  createdAt?: string;
}

export interface AcademicSession {
  _id: string;
  year: string;
  semesterLabel: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Section {
  _id: string;
  name: string;
  department: Department | any;
  semester: number;
  year: number; // 1, 2, 3, 4
  session: AcademicSession | any;
  batch?: Batch | any;
  createdAt?: string;
}

export interface Subject {
  _id: string;
  name: string;
  code: string;
  department: Department | any;
  semester: number;
  year: number; // 1, 2, 3, 4
  credits: number;
  batch?: Batch | any;
  isActive?: boolean;
  assignedTeacher?: User | any;
  assignedTeachers?: { teacher: User; section: Section }[];
  createdAt?: string;
}

export interface PeriodTemplate {
  _id: string;
  section: Section | any;
  periodNumber: number;
  startTime: string;
  endTime: string;
  createdAt?: string;
}

export interface Batch {
  _id: string;
  name: string;
  course: Course | any;
  startYear: number;
  endYear: number;
  isActive: boolean;
  studentCount?: number;
  assignedTeachers?: (User | any)[];
  coordinators?: (User | any)[];
  createdAt?: string;
}

export interface Student {
  _id: string;
  name: string;
  rollNumber: string;
  section: Section | any;
  department: Department | any;
  batch?: Batch | any;
  semester: number;
  year: number; // 1, 2, 3, 4
  email?: string;
  phone?: string;
  isActive: boolean;
  condonedPeriods?: number;
  condonationReason?: string;
  condonedBy?: User | string;
  condonedAt?: string;
  createdAt?: string;
}

export interface TeacherSubjectAssignment {
  _id: string;
  teacher: User | any;
  subject: Subject | any;
  section: Section | any;
  session: AcademicSession | any;
  createdAt?: string;
}

export interface PeriodSlot {
  _id: string;
  section: Section | any;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject?: Subject | any;
  teacher?: User | any;
  session: AcademicSession | any;
  batch?: Batch | any;
  isRecess?: boolean;
  recessLabel?: string;
  studentCount?: number;
  isMarked?: boolean;
  attendanceId?: string | null;
  markedAt?: string | null;
  lastEditedAt?: string | null;
  canEdit?: boolean;
  stats?: {
    present: number;
    late: number;
    absent: number;
  } | null;
}

export interface Holiday {
  _id: string;
  date: string;
  name: string;
  scope?: 'all' | 'course' | 'department';
  course?: Course | any;
  department?: Department | any;
  session?: AcademicSession | any;
  createdAt?: string;
}

export interface AttendanceRecord {
  student: Student | string;
  status: 'present' | 'absent' | 'late';
}

export interface Attendance {
  _id: string;
  date: string;
  periodSlot: PeriodSlot | string;
  subject: Subject | any;
  section: Section | any;
  teacher: User | any;
  session: AcademicSession | string;
  records: AttendanceRecord[];
  markedAt: string;
  lastEditedAt?: string | null;
  createdAt?: string;
}

export interface SystemSettings {
  _id?: string;
  editWindowHours: number;
  attendanceThresholdPercent: number;
  institutionName: string;
}

export interface DepartmentYearMatrixItem {
  departmentId: string;
  name: string;
  code: string;
  year1: number;
  year2: number;
  year3: number;
  year4: number;
  total: number;
}

export interface DefaulterRecord {
  studentId: string;
  name: string;
  rollNumber: string;
  section: string;
  year?: number;
  subject: string;
  totalPeriods: number;
  present: number;
  late: number;
  absent: number;
  condonedPeriods?: number;
  condonationReason?: string;
  percentage: number;
}

export interface DefaulterResponse {
  month: string;
  threshold: number;
  mode: 'subject' | 'overall';
  defaulters: DefaulterRecord[];
  stats: {
    totalDefaulters: number;
    avgPercentage: number;
    worstPercentage: number;
    worstStudent: string;
  };
}

export interface CsvImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
  passwords?: Array<{ row: number; name: string; email: string; temporaryPassword: string }>;
}
