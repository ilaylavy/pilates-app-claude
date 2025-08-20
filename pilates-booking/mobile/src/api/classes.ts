import { apiClient } from './client';
import { ClassInstance } from '../types';

export interface ParticipantResponse {
  id: number;
  name: string;
  email: string;
  booking_date: string;
}

export interface ClassCreateData {
  template_id: number;
  instructor_id: number;
  start_datetime: string;
  end_datetime: string;
  actual_capacity?: number;
  notes?: string;
}

export interface ClassUpdateData {
  instructor_id?: number;
  start_datetime?: string;
  end_datetime?: string;
  status?: string;
  actual_capacity?: number;
  notes?: string;
}

export const classesApi = {
  getUpcomingClasses: async (daysAhead = 7): Promise<ClassInstance[]> => {
    const response = await apiClient.get<ClassInstance[]>(`/api/v1/classes/upcoming?days_ahead=${daysAhead}`);
    return response.data;
  },

  getClassById: async (classId: number): Promise<ClassInstance> => {
    const response = await apiClient.get<ClassInstance>(`/api/v1/classes/${classId}`);
    return response.data;
  },

  getWeekClasses: async (weekDate: string): Promise<ClassInstance[]> => {
    const response = await apiClient.get<ClassInstance[]>(`/api/v1/classes/week/${weekDate}`);
    return response.data;
  },

  getMonthClasses: async (year: number, month: number): Promise<ClassInstance[]> => {
    const response = await apiClient.get<ClassInstance[]>(`/api/v1/classes/month/${year}/${month}`);
    return response.data;
  },

  getClassParticipants: async (classId: number): Promise<ParticipantResponse[]> => {
    const response = await apiClient.get<ParticipantResponse[]>(`/api/v1/classes/${classId}/participants`);
    return response.data;
  },

  createClass: async (classData: ClassCreateData): Promise<ClassInstance> => {
    const response = await apiClient.post<ClassInstance>('/api/v1/classes/create', classData);
    return response.data;
  },

  updateClass: async (classId: number, classData: ClassUpdateData): Promise<ClassInstance> => {
    const response = await apiClient.patch<ClassInstance>(`/api/v1/classes/${classId}`, classData);
    return response.data;
  },

  deleteClass: async (classId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/classes/${classId}`);
  },
};