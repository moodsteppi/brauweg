import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, type ClubDetail, type ChatMessage } from '../api';
import { setzeUmfang } from '../umfang';
import { Clan } from './Clan';
import { ClanChat } from './ClanChat';

vi.mock('../laufzeit', async () => ({
  ...(await vi.importActual('../laufzeit')),
  inApp: true,
}));
const nachricht: ChatMessage = {
  id: 'n1',
  kind: 'text',
  accountId: 'freund',
  displayName: 'Kiebitz',
  hasAvatar: false,
  body: 'Hallo Clan!',
  deleted: false,
  createdAt: '2026-11-28T10:00:00Z',
};
const detail: ClubDetail = {
  id: 'c1',
  name: 'Die Asse',
  crest: 'wappen-1',
  motto: null,
  joinMode: 'open',
  minTrophies: 0,
  members: 1,
  maxMembers: 50,
  trophies: 0,
  myRole: 'admin',
  memberList: [],
  requests: [],
  defaultRuleSetId: null,
};
beforeEach(() => {
  setzeUmfang(null);
  vi.spyOn(api, 'club').mockResolvedValue(detail);
  vi.spyOn(api, 'clubMessages').mockResolvedValue({ messages: [nachricht] });
  vi.spyOn(api, 'postClubMessage').mockImplementation(async (_id, body) => ({
    ...nachricht,
    id: 'n2',
    accountId: 'ich',
    body,
  }));
});
afterEach(() => {
  cleanup();
  setzeUmfang(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const halle = () =>
  render(
    <Clan
      neu
      clanId="c1"
      meId="ich"
      onBald={vi.fn()}
      onShowProfile={vi.fn()}
      onMeChange={vi.fn()}
    />,
  );

describe('Clan-Chat in der App', () => {
  it('öffnet den Chat aus der Halle, lädt Nachrichten und sendet an den gewählten Clan', async () => {
    halle();
    await screen.findByRole('heading', { name: 'Die Asse' });
    fireEvent.click(screen.getByRole('button', { name: 'Clanchat' }));
    expect(await screen.findByText('Hallo Clan!')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Neue Runde?' },
    });
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);
    await waitFor(() =>
      expect(api.postClubMessage).toHaveBeenCalledWith('c1', 'Neue Runde?'),
    );
    expect(await screen.findByText('Neue Runde?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Zurück/ }));
    expect(
      screen.getByRole('heading', { name: 'Die Asse' }),
    ).toBeInTheDocument();
  });
  it('respektiert weiterhin die Freigabe des Servers', async () => {
    setzeUmfang([]);
    halle();
    await screen.findByRole('heading', { name: 'Die Asse' });
    expect(
      screen.queryByRole('button', { name: 'Clanchat' }),
    ).not.toBeInTheDocument();
  });
  it('fragt in einem inaktiven Hub-Tab nicht laufend nach Nachrichten', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <div inert>
        <ClanChat
          clubId="c1"
          meId="ich"
          darfLoeschen={false}
          onClose={vi.fn()}
          onShowProfile={vi.fn()}
        />
      </div>,
    );
    await act(async () => {});
    expect(api.clubMessages).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(api.clubMessages).toHaveBeenCalledTimes(1);
    rerender(
      <div>
        <ClanChat
          clubId="c1"
          meId="ich"
          darfLoeschen={false}
          onClose={vi.fn()}
          onShowProfile={vi.fn()}
        />
      </div>,
    );
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(api.clubMessages).toHaveBeenCalledTimes(2);
  });
});
