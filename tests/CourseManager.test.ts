import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

vi.mock('hytopia', () => ({}));

import { CourseManager } from '../src/systems/CourseManager';
import { COURSES } from '../src/config/courseConfig';

describe('CourseManager', () => {
  let cm: CourseManager;

  beforeEach(() => {
    cm = new CourseManager();
  });

  it('starts at course index 0', () => {
    expect(cm.courseIndex).toBe(0);
    expect(cm.courseId).toBe('course1');
  });

  it('totalCourses matches COURSES array length', () => {
    expect(cm.totalCourses).toBe(COURSES.length);
    expect(cm.totalCourses).toBe(4);
  });

  it('advanceCourse cycles 0→1→2→3→0', () => {
    expect(cm.courseIndex).toBe(0);

    cm.advanceCourse();
    expect(cm.courseIndex).toBe(1);
    expect(cm.courseId).toBe('course2');

    cm.advanceCourse();
    expect(cm.courseIndex).toBe(2);
    expect(cm.courseId).toBe('course3');

    cm.advanceCourse();
    expect(cm.courseIndex).toBe(3);
    expect(cm.courseId).toBe('course4');

    cm.advanceCourse();
    expect(cm.courseIndex).toBe(0);
    expect(cm.courseId).toBe('course1');
  });

  it('advanceCourse returns the new active course', () => {
    const course = cm.advanceCourse();
    expect(course.id).toBe('course2');
    expect(course).toBe(cm.activeCourse);
  });

  it('nextCourse peeks without advancing', () => {
    const next = cm.nextCourse();
    expect(next.id).toBe('course2');
    expect(cm.courseIndex).toBe(0); // didn't advance
    expect(cm.courseId).toBe('course1');
  });

  it('nextCourse wraps around at end', () => {
    cm.advanceCourse(); // 1
    cm.advanceCourse(); // 2
    cm.advanceCourse(); // 3
    const next = cm.nextCourse();
    expect(next.id).toBe('course1');
    expect(cm.courseIndex).toBe(3); // still at 3
  });

  it('activeCourse returns current course definition', () => {
    expect(cm.activeCourse).toBe(COURSES[0]);
    expect(cm.courseName).toBe('Neon Gauntlet');
  });
});
