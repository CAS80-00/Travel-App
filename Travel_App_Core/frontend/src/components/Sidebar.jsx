<div className="sidebar">
  {wiki.sections.map((section, index) => (
    <button
      key={index}
      onClick={() =>
        document.getElementById(`section-${index}`).scrollIntoView({
          behavior: "smooth",
        })
      }
    >
      {section.title}
    </button>
  ))}
</div>;
