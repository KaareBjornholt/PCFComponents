import React, { useState, useEffect, useRef } from "react";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressLookupProps {
  value: string;
  onChange: (value: string, suggestion?: Suggestion) => void;
}

const AddressLookup: React.FC<AddressLookupProps> = ({ value, onChange }: AddressLookupProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimeout = useRef<number | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!inputValue) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    setError(null);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = window.setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          inputValue
        )}&format=json&addressdetails=1&limit=5`
      )
        .then((res) => res.json())
        .then((data) => {
          setSuggestions(data);
          setShowDropdown(true);
          setLoading(false);
          return null;
        })
        .catch((err) => {
          setError("Failed to fetch suggestions");
          setLoading(false);
          return null;
        });
    }, 400);
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    onChange(e.target.value);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setInputValue(suggestion.display_name);
    setShowDropdown(false);
    onChange(suggestion.display_name, suggestion);
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
        placeholder="Enter address..."
        autoComplete="off"
      />
      {loading && <div style={{ position: "absolute", top: "100%", left: 0 }}>Loading...</div>}
      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #ccc",
            zIndex: 1000,
            listStyle: "none",
            margin: 0,
            padding: 0,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {suggestions.map((s, idx) => (
            <li
              key={idx}
              onClick={() => handleSuggestionClick(s)}
              style={{ padding: "8px", cursor: "pointer" }}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default AddressLookup; 