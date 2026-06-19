import type React from 'react';

import {
  UiBadge,
  UiButton,
  UiEmptyState,
  UiTable,
  UiTbody,
  UiTd,
  UiTh,
  UiThead,
  UiTr,
} from '../../components/ui';
import type { Persona } from '../../types';

type PersonasTabProps = {
  personas: Persona[];
  cardStyle: React.CSSProperties;
  sectionTitleStyle: React.CSSProperties;
  colors: {
    primary: string;
    text: string;
    textLight: string;
    border: string;
  };
  onNewPersona: () => void;
  onEditPersona: (persona: Persona) => void;
  onDeletePersona: (id: number) => void;
};

export const PersonasTab = ({
  personas,
  cardStyle,
  sectionTitleStyle,
  colors,
  onNewPersona,
  onEditPersona,
  onDeletePersona,
}: PersonasTabProps): React.ReactNode => (
  <section style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
    <div
      style={{
        padding: '24px 28px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#fcfcfd',
      }}
    >
      <div>
        <h2 style={{ ...sectionTitleStyle, marginBottom: 4 }}>Redaktorzy</h2>
        <p style={{ fontSize: 13, color: colors.textLight, margin: 0 }}>
          Twórz wirtualnych autorów o własnym, rozpoznawalnym stylu pisania. Przypisz redaktora do
          przepływu, aby treści brzmiały spójnie i po ludzku.
        </p>
      </div>
      <UiButton variant="primary" onClick={onNewPersona}>
        + Nowy redaktor
      </UiButton>
    </div>

    <div>
      {personas.length === 0 ? (
        <div style={{ padding: 28 }}>
          <UiEmptyState
            title="Nie masz jeszcze żadnego redaktora"
            description={
              <>
                Redaktor to wirtualny autor z własnym głosem — np. „ciepła astrolożka” albo
                „rzeczowy ekspert”. Dodaj pierwszego, aby teksty miały charakter.
              </>
            }
            action={
              <UiButton variant="primary" onClick={onNewPersona}>
                + Nowy redaktor
              </UiButton>
            }
          />
        </div>
      ) : (
        <UiTable colCount={5} rowCount={personas.length + 1}>
          <UiThead>
            <UiTr>
              <UiTh>Redaktor</UiTh>
              <UiTh>Specjalizacja</UiTh>
              <UiTh>Temperament</UiTh>
              <UiTh>Aktywny</UiTh>
              <UiTh style={{ textAlign: 'right' }}>Akcje</UiTh>
            </UiTr>
          </UiThead>
          <UiTbody>
            {personas.map((persona) => (
              <UiTr key={persona.id} style={{ transition: 'background 0.2s' }}>
                <UiTd>
                  <strong style={{ color: colors.text }}>{persona.name}</strong>
                  {persona.byline ? (
                    <div style={{ fontSize: 12, color: colors.textLight, marginTop: 2 }}>
                      {persona.byline}
                    </div>
                  ) : null}
                </UiTd>
                <UiTd>
                  <span style={{ fontSize: 13, color: colors.textLight }}>
                    {persona.specialization || '-'}
                  </span>
                </UiTd>
                <UiTd>
                  <span style={{ fontSize: 13, color: colors.textLight }}>
                    {persona.temperament || '-'}
                  </span>
                </UiTd>
                <UiTd>
                  {persona.active ? (
                    <UiBadge tone="success" size="S">
                      Tak
                    </UiBadge>
                  ) : (
                    <UiBadge tone="neutral" size="S">
                      Nie
                    </UiBadge>
                  )}
                </UiTd>
                <UiTd>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <UiButton variant="secondary" size="S" onClick={() => onEditPersona(persona)}>
                      Edytuj
                    </UiButton>
                    <UiButton
                      variant="danger"
                      size="S"
                      onClick={() => void onDeletePersona(persona.id)}
                    >
                      Usuń
                    </UiButton>
                  </div>
                </UiTd>
              </UiTr>
            ))}
          </UiTbody>
        </UiTable>
      )}
    </div>
  </section>
);
