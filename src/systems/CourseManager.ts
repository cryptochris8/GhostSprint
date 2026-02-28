/**
 * CourseManager — tracks which course is active and rotates sequentially.
 */

import { COURSES } from '../config/courseConfig';
import type { CourseDefinition } from '../config/courseConfig';

export class CourseManager {
  private _courseIndex = 0;

  get activeCourse(): CourseDefinition { return COURSES[this._courseIndex]; }
  get courseId(): string { return this.activeCourse.id; }
  get courseName(): string { return this.activeCourse.name; }
  get courseIndex(): number { return this._courseIndex; }
  get totalCourses(): number { return COURSES.length; }

  /** Advance to the next course (wraps around). Returns the new active course. */
  advanceCourse(): CourseDefinition {
    this._courseIndex = (this._courseIndex + 1) % COURSES.length;
    return this.activeCourse;
  }

  /** Peek at the next course without advancing. */
  nextCourse(): CourseDefinition {
    return COURSES[(this._courseIndex + 1) % COURSES.length];
  }
}
