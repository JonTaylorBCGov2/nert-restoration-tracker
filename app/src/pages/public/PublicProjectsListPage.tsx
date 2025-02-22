import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Chip from '@material-ui/core/Chip';
import Container from '@material-ui/core/Container';
import Link from '@material-ui/core/Link';
import Paper from '@material-ui/core/Paper';
import { Theme } from '@material-ui/core/styles/createMuiTheme';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import clsx from 'clsx';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { DownloadEMLI18N } from 'constants/i18n';
import { ProjectStatusType } from 'constants/misc';
import { AuthStateContext } from 'contexts/authStateContext';
import { DialogContext } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useRestorationTrackerApi } from 'hooks/useRestorationTrackerApi';
import { IGetProjectsListResponse } from 'interfaces/useProjectApi.interface';
import moment from 'moment';
import React, { useContext, useEffect, useState } from 'react';
import { Redirect, useHistory } from 'react-router';
import { getFormattedDate, triggerFileDownload } from 'utils/Utils';

const useStyles = makeStyles((theme: Theme) => ({
  linkButton: {
    textAlign: 'left'
  },
  chip: {
    color: 'white'
  },
  chipActive: {
    backgroundColor: theme.palette.success.main
  },
  chipPublishedCompleted: {
    backgroundColor: theme.palette.success.main
  },
  chipDraft: {
    backgroundColor: theme.palette.info.main
  }
}));

const PublicProjectsListPage = () => {
  const { keycloakWrapper } = useContext(AuthStateContext);
  const restorationTrackerApi = useRestorationTrackerApi();
  const classes = useStyles();
  const history = useHistory();

  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<IGetProjectsListResponse[]>([]);

  const dialogContext = useContext(DialogContext);

  useEffect(() => {
    const getProjects = async () => {
      const projectsResponse = await restorationTrackerApi.public.project.getProjectsList();

      setProjects(() => {
        setIsLoading(false);
        return projectsResponse;
      });
    };

    if (isLoading) {
      getProjects();
    }
  }, [restorationTrackerApi, isLoading]);

  const getProjectStatusType = (projectData: IGetProjectsListResponse): ProjectStatusType => {
    if (projectData.end_date && moment(projectData.end_date).endOf('day').isBefore(moment())) {
      return ProjectStatusType.COMPLETED;
    }

    return ProjectStatusType.ACTIVE;
  };

  const getChipIcon = (status_name: string) => {
    let chipLabel;
    let chipStatusClass;

    if (ProjectStatusType.ACTIVE === status_name) {
      chipLabel = 'Active';
      chipStatusClass = classes.chipActive;
    } else if (ProjectStatusType.COMPLETED === status_name) {
      chipLabel = 'Completed';
      chipStatusClass = classes.chipPublishedCompleted;
    }

    return <Chip size="small" className={clsx(classes.chip, chipStatusClass)} label={chipLabel} />;
  };

  const navigateToPublicProjectPage = (id: number) => {
    history.push(`/projects/${id}`);
  };

  if (keycloakWrapper?.keycloak.authenticated) {
    // User has a role
    return <Redirect to={{ pathname: '/admin/projects' }} />;
  }

  const handleDownloadProjectEML = async (projectId: number) => {
    let response;

    try {
      response = await restorationTrackerApi.public.project.downloadProjectEML(projectId);
    } catch (error) {
      dialogContext.setErrorDialog({
        dialogTitle: DownloadEMLI18N.errorTitle,
        dialogText: DownloadEMLI18N.errorText,
        dialogError: (error as APIError).message,
        dialogErrorDetails: (error as APIError).errors,
        open: true,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });

      return;
    }

    triggerFileDownload(response.fileData, response.fileName);
  };

  return (
    <Container maxWidth="xl">
      <Box mb={5}>
        <Box mb={1}>
          <Typography variant="h1">Projects</Typography>
        </Box>
        <Typography variant="body1" color="textSecondary">
          BC habitat restoration projects and related data.
        </Typography>
      </Box>
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Permits</TableCell>
                <TableCell>Contact Agencies</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell width="105" align="left">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody data-testid="project-table">
              {!projects?.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Box display="flex" justifyContent="center">
                      No Results
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {projects?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell component="th" scope="row">
                    <Link
                      data-testid={row.name}
                      underline="always"
                      component="button"
                      variant="body2"
                      onClick={() => navigateToPublicProjectPage(row.id)}>
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.permits_list}</TableCell>
                  <TableCell>{row.contact_agency_list}</TableCell>
                  <TableCell>{getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.start_date)}</TableCell>
                  <TableCell>{getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.end_date)}</TableCell>
                  <TableCell>{getChipIcon(getProjectStatusType(row))}</TableCell>
                  <TableCell>
                    <Box my={-1}>
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        title="Download Project Metadata"
                        aria-label="Download Project Metadata"
                        data-testid="project-table-download-eml"
                        onClick={() => handleDownloadProjectEML(row.id)}>
                        Download
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default PublicProjectsListPage;
