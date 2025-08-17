import { apiClient } from './client';
import { ClassInstance } from '../types';

export const classesApi = {
  getUpcomingClasses: async (daysAhead = 7): Promise<ClassInstance[]> => {
    const response = await apiClient.get<ClassInstance[]>(`/classes/upcoming?days_ahead=${daysAhead}`);
    return response.data;
  },

  getClassById: async (classId: number): Promise<ClassInstance> => {
    const response = await apiClient.get<ClassInstance>(`/classes/${classId}`);
    return response.data;
  },
};