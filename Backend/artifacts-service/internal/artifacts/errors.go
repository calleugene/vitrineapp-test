package artifacts

import "errors"

var (
	ErrBadRequest            = errors.New("bad request")
	ErrNotFound              = errors.New("not found")
	ErrCannotDelete          = errors.New("cannot delete system screen")
	ErrCannotReorder         = errors.New("invalid reorder: system screens must stay at borders")
	ErrRevisionConflict      = errors.New("revision conflict")
	ErrNoUnpublishedChanges  = errors.New("no unpublished changes")
	ErrUnsupportedScreenType = errors.New("unsupported screen type")
	ErrCannotPublishEmpty    = errors.New("cannot publish without screens")
	ErrArchivedArtifact      = errors.New("archived artifact must be restored before publishing")
)
