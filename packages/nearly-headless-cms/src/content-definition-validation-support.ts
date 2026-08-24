import { InvalidInput, type ValidationIssue } from "./cms-error.ts";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/u,
  createValidationIssue = (
    path: readonly (string | number)[],
    reason: string,
    message: string,
  ): ValidationIssue => ({ message, path, reason }),
  customIdentifierPattern = /^(?:[a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/u,
  daysInCalendarMonth = (year: number, month: number): number => {
    if (month === 2) {
      const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      if (isLeapYear) {
        return 29;
      }
      return 28;
    }
    if ([4, 6, 9, 11].includes(month)) {
      return 30;
    }
    return 31;
  },
  defaultCalendarDay = 1,
  defaultCalendarMonth = 1,
  defaultCalendarYear = 0,
  defaultCompilerFormatVersion = 1,
  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u,
  emptyLength = 0,
  failValidation = (message: string, issues: readonly ValidationIssue[]): never => {
    const [firstIssue] = issues;
    let issueLocation = "";
    if (firstIssue !== undefined) {
      issueLocation = ` at ${firstIssue.path.join(".")}`;
    }
    throw InvalidInput.make({ issues: [...issues], message: `${message}${issueLocation}` });
  },
  identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u,
  utcDatetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
  validateCalendarDate = (value: string): boolean => {
    if (!calendarDatePattern.test(value)) {
      return false;
    }
    const [year, month, day] = value.split("-").map(Number),
      monthDayCount = daysInCalendarMonth(
        year ?? defaultCalendarYear,
        month ?? defaultCalendarMonth,
      ),
      normalizedDay = day ?? defaultCalendarDay,
      normalizedMonth = month ?? defaultCalendarMonth;
    return (
      normalizedMonth >= 1 &&
      normalizedMonth <= 12 &&
      normalizedDay >= 1 &&
      normalizedDay <= monthDayCount
    );
  },
  validateIdentifier = (
    identifier: string,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (identifierPattern.test(identifier)) {
      return [];
    }
    return [
      createValidationIssue(
        path,
        "invalidIdentifier",
        `Invalid URL-safe lowercase identifier: ${identifier}`,
      ),
    ];
  };

export default {
  calendarDatePattern,
  createValidationIssue,
  customIdentifierPattern,
  daysInCalendarMonth,
  defaultCalendarDay,
  defaultCalendarMonth,
  defaultCalendarYear,
  defaultCompilerFormatVersion,
  emailPattern,
  emptyLength,
  failValidation,
  identifierPattern,
  utcDatetimePattern,
  validateCalendarDate,
  validateIdentifier,
};
