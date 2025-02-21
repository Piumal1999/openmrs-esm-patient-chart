import React from 'react';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, usePagination } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { mockEnrolledProgramsResponse } from '../__mocks__/programs.mock';
import { mockPatient, renderWithSwr, waitForLoadingToFinish } from '../../../../tools/test-helpers';
import ProgramsDetailedSummary from './programs-detailed-summary.component';

jest.setTimeout(20000);

const mockOpenmrsFetch = openmrsFetch as jest.Mock;
const mockUsePagination = usePagination as jest.Mock;

jest.mock('@openmrs/esm-framework', () => {
  const originalModule = jest.requireActual('@openmrs/esm-framework');

  return {
    ...originalModule,
    openmrsFetch: jest.fn(),
    usePagination: jest.fn().mockImplementation(() => ({
      currentPage: 1,
      goTo: () => {},
      results: [],
    })),
  };
});

jest.mock('@openmrs/esm-patient-common-lib', () => {
  const originalModule = jest.requireActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: jest.fn(),
  };
});

describe('ProgramsDetailedSummary ', () => {
  it('renders an empty state view when the patient is not enrolled into any programs', async () => {
    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: [] } });

    renderProgramsOverview();

    await waitForLoadingToFinish();

    expect(screen.getByText(/Care Programs/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no program enrollments to display for this patient/)).toBeInTheDocument();
    expect(screen.getByText(/Record program enrollments/)).toBeInTheDocument();
  });

  it('renders an error state view if there is a problem fetching program enrollments', async () => {
    const error = {
      message: 'You are not logged in',
      response: {
        status: 401,
        statusText: 'Unauthorized',
      },
    };

    mockOpenmrsFetch.mockRejectedValueOnce(error);

    renderProgramsOverview();

    await waitForLoadingToFinish();

    expect(screen.getByText(/Care Programs/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sorry, there was a problem displaying this information. You can try to reload this page, or contact the site administrator and quote the error code above./,
      ),
    ).toBeInTheDocument();
  });

  it("renders a detailed tabular summary of the patient's program enrollments", async () => {
    const user = userEvent.setup();

    mockOpenmrsFetch.mockReturnValueOnce({ data: { results: mockEnrolledProgramsResponse } });
    mockUsePagination.mockImplementation(() => ({
      currentPage: 1,
      goTo: () => {},
      results: mockEnrolledProgramsResponse.slice(0, 5),
    }));

    renderProgramsOverview();

    await waitForLoadingToFinish();

    expect(screen.getByText(/Care Programs/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /active programs/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /date enrolled/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();

    const addButton = screen.getByRole('button', { name: /Add/ });
    expect(addButton).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /hiv care and treatment/i });
    expect(row).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: /16-Jan-2020/i })).toBeInTheDocument();
    expect(within(row).getByRole('cell', { name: /active$/i })).toBeInTheDocument();
    const editButton = within(row).getByRole('button', { name: /Edit Program$/i });
    expect(editButton).toBeInTheDocument();

    // Clicking "Add" launches the programs form in a workspace
    await waitFor(() => user.click(addButton));

    expect(launchPatientWorkspace).toHaveBeenCalledWith('programs-form-workspace');

    // Clicking the edit button launches the edit form in a workspace
    await waitFor(() => user.click(editButton));

    expect(launchPatientWorkspace).toHaveBeenCalledWith('programs-form-workspace', {
      programEnrollmentId: mockEnrolledProgramsResponse[0].uuid,
    });
  });
});

function renderProgramsOverview() {
  const testProps = {
    patientUuid: mockPatient.id,
  };
  renderWithSwr(<ProgramsDetailedSummary {...testProps} />);
}
