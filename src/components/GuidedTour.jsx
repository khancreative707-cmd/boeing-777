import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ENGINE_TOUR } from '../engine/tour.js';

export function GuidedTour({ lab, step }) {
  const chapters = lab.tour || ENGINE_TOUR;
  if (step === null) return null;
  const chapter = chapters[step];
  return (
    <section
      className="guided-tour"
      aria-label={lab.kind === 'aircraft' ? 'Guided aircraft tour' : 'Guided engine tour'}
    >
      <div className="tour-topline">
        <span>
          {lab.kind === 'aircraft' ? 'AIRCRAFT' : 'ENGINE'} WALKTHROUGH · {step + 1} /{' '}
          {chapters.length}
        </span>
        <button className="icon-button" aria-label="End guided tour" onClick={() => lab.endTour()}>
          <X size={14} />
        </button>
      </div>
      <div className="tour-progress" aria-label="Tour chapters">
        {chapters.map((part, index) => (
          <button
            key={part.id}
            aria-label={`Tour chapter ${index + 1}: ${part.title}`}
            aria-current={index === step ? 'step' : undefined}
            onClick={() => lab.setTourStep(index)}
          />
        ))}
      </div>
      <h3>{chapter.title}</h3>
      <p>{chapter.text}</p>
      <div className="tour-actions">
        <button className="button" disabled={step === 0} onClick={() => lab.setTourStep(step - 1)}>
          <ChevronLeft size={13} />
          Previous
        </button>
        <button
          className="button"
          onClick={() => (step === chapters.length - 1 ? lab.endTour() : lab.setTourStep(step + 1))}
        >
          {step === chapters.length - 1 ? 'Explore freely' : 'Next system'}
          <ChevronRight size={13} />
        </button>
      </div>
    </section>
  );
}
