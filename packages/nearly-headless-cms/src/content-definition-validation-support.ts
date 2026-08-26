import { InvalidInput, type ValidationIssue } from "./cms-error.ts";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/u,
  calendarDayMinimum = 1,
  calendarMonthDayCountThirty = 30,
  calendarMonthDayCountThirtyOne = 31,
  calendarMonthHasThirtyDays = (month: number): boolean =>
    month === leapYearDivisorFour ||
    month === calendarMonthJune ||
    month === calendarMonthSeptember ||
    month === calendarMonthNovember,
  calendarMonthJune = 6,
  calendarMonthMaximum = 12,
  calendarMonthMinimum = 1,
  calendarMonthNovember = 11,
  calendarMonthSeptember = 9,
  createValidationIssue = (
    path: readonly (string | number)[],
    reason: string,
    message: string,
  ): ValidationIssue => ({ message, path, reason }),
  customIdentifierPattern = /^(?:[a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/u,
  daysInCalendarMonth = (year: number, month: number): number => {
    if (month === februaryMonthNumber) {
      const isLeapYear =
        year % leapYearDivisorFour === 0 &&
        (year % leapYearDivisorOneHundred !== 0 || year % leapYearDivisorFourHundred === 0);
      if (isLeapYear) {
        return februaryLeapYearDayCount;
      }
      return februaryStandardDayCount;
    }
    if (calendarMonthHasThirtyDays(month)) {
      return calendarMonthDayCountThirty;
    }
    return calendarMonthDayCountThirtyOne;
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
  februaryLeapYearDayCount = 29,
  februaryMonthNumber = 2,
  februaryStandardDayCount = 28,
  identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u,
  leapYearDivisorFour = 4,
  leapYearDivisorFourHundred = 400,
  leapYearDivisorOneHundred = 100,
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
      normalizedMonth >= calendarMonthMinimum &&
      normalizedMonth <= calendarMonthMaximum &&
      normalizedDay >= calendarDayMinimum &&
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
