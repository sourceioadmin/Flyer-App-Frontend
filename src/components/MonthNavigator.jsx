import { MONTH_NAMES } from '../constants/flyerTitles';
import './MonthNavigator.css';

const MonthNavigator = ({ currentYear, currentMonth, onMonthChange }) => {
  const handlePrevious = () => {
    if (currentMonth === 1) {
      onMonthChange(currentYear - 1, 12);
    } else {
      onMonthChange(currentYear, currentMonth - 1);
    }
  };

  const handleNext = () => {
    if (currentMonth === 12) {
      onMonthChange(currentYear + 1, 1);
    } else {
      onMonthChange(currentYear, currentMonth + 1);
    }
  };

  return (
    <div className="month-navigator">
      <button onClick={handlePrevious} className="month-nav-btn">
        ◀ Previous
      </button>
      <div className="current-month">
        <h2>{MONTH_NAMES[currentMonth - 1]} {currentYear}</h2>
      </div>
      <button onClick={handleNext} className="month-nav-btn">
        Next ▶
      </button>
    </div>
  );
};

export default MonthNavigator;
