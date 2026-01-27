import './CompanySelector.css';
import { useId } from 'react';

const CompanySelector = ({ companies, selectedCompanyId, onCompanyChange, label = "Select Company" }) => {
  const selectId = useId();

  return (
    <div className="company-selector">
      <label htmlFor={selectId}>{label}:</label>
      <select
        id={selectId}
        value={selectedCompanyId || ''}
        onChange={(e) => onCompanyChange(e.target.value ? parseInt(e.target.value) : null)}
        className="company-select-input"
      >
        <option key="all-companies" value="">All Companies</option>
        {companies.map((company, index) => (
          <option key={`company-${company.id || company.Id}-${index}`} value={company.id || company.Id}>
            {company.name || company.Name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CompanySelector;
