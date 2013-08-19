var controllers = angular.module('opal.controllers', [
	'ngCookies',
	'opal.services',
	'ui.event',
	'ui.bootstrap',
]);

controllers.controller('RootCtrl', function($scope) {
	$scope.keydown = function(e) {
		$scope.$broadcast('keydown', e);
	};
});

controllers.controller('PatientListCtrl', function($scope, $cookieStore, $dialog, Patient, schema, patients, options) {
	$scope.state = 'normal';

	$scope.rix = 0; // row index
	$scope.cix = 0; // column index
	$scope.iix = 0; // item index

	$scope.mouseRix = -1; // index of row mouse is currently over
	$scope.mouseCix = -1; // index of column mouse is currently over

	$scope.query = {hospital: '', ward: ''};
	$scope.currentTag = $cookieStore.get('opal.currentTag') || 'mine'; // initially display patients of interest to current user

	$scope.columns = []
	for (var cix = 0; cix < schema.getNumberOfColumns(); cix++) {
		if (schema.getColumnByIx(cix).name != 'microbiology_input') {
			$scope.columns.push(schema.getColumnByIx(cix));
		}
	}

	$scope.patients = patients;

	$scope.rows = getVisiblePatients();

	function getVisiblePatients() {
		var patient;
		var patients = [];

		for (var pix = 0; pix < $scope.patients.length; pix++) {
			patient = $scope.patients[pix]
			if (patient.isVisible($scope.currentTag, $scope.query.hospital, $scope.query.ward)) {
				patients.push(patient);
			};
		};
		patients.sort(comparePatients);
		return patients;
	};

	function comparePatients(p1, p2) {
		return p1.compare(p2);
	};

	$scope.$watch('currentTag', function() {
		$cookieStore.put('opal.currentTag', $scope.currentTag);
		$scope.rows = getVisiblePatients();
		$scope.rix = 0;
	});

	$scope.$watch('query.hospital', function() {
		$scope.rows = getVisiblePatients();
	});

	$scope.$watch('query.ward', function() {
		$scope.rows = getVisiblePatients();
	});

	$scope.$on('keydown', function(event, e) {
		if ($scope.state == 'normal') {
			switch (e.keyCode) {
				case 37: // left
					goLeft();
					break;
				case 39: // right
					goRight();
					break;
				case 38: // up
					goUp();
					break;
				case 40: // down
					goDown();
					break;
				case 13: // enter
				case 113: // F2
					$scope.editItem($scope.rix, $scope.cix, $scope.iix);
					break;
				case 8: // backspace
					e.preventDefault();
				case 46: // delete
					$scope.deleteItem($scope.rix, $scope.cix, $scope.iix);
					break;
				case 191: // question mark
					if(e.shiftKey){
						showKeyboardShortcuts();
					}
					break;
			};
		};
	});

	function getColumnName(cix) {
		return $scope.columns[cix].name;
	};

	function getRowIxFromPatientId(patientId) {
		for (var rix = 0; rix < $scope.rows.length; rix++) {
			if ($scope.rows[rix].id == patientId) {
				return rix;
			}
		};
		return -1;
	};

	function getPatient(rix) {
		return $scope.rows[rix];
	};

	$scope.print = function() {
		window.print();
	};

	$scope.selectItem = function(rix, cix, iix) {
		$scope.rix = rix;
		$scope.cix = cix;
		$scope.iix = iix;
	};

	$scope.focusOnQuery = function() {
		$scope.selectItem(-1, -1, -1);
		$scope.state = 'search';
	};

	$scope.blurOnQuery = function() {
		if ($scope.rix == -1) {
			$scope.selectItem(0, 0, 0);
		};
		$scope.state = 'normal';
	};

	$scope.addPatient = function() {
		var modal;
		$scope.state = 'modal';

		modal = $dialog.dialog({
			templateUrl: '/templates/modals/add_patient.html/',
			controller: 'AddPatientCtrl',
			resolve: {
				currentTag: function() { return $scope.currentTag; },
				options: function() { return options; },
			}
		});

		modal.open().then(function(result) {
			var patient;
			$scope.state = 'normal';

			if (angular.isObject(result)) {
				// result is attributes of patient
				patient = new Patient(result, schema)
				rix = getRowIxFromPatientId(patient.id);
				if (rix != -1) {
					// If patient is already in table, remove the corresponding row.
					// This guards against user changing patient data in add form.
					$scope.rows.splice(rix, 1);
				}
				$scope.patients.push(patient);
				$scope.rows = getVisiblePatients();
				$scope.selectItem(getRowIxFromPatientId(patient.id), 0, 0);
			}
		});
	};

	$scope.dischargePatient = function(rix, event) {
		var modal;
		var patient = getPatient(rix);

		// This is required to prevent the page reloading
		event.preventDefault();

		$scope.state = 'modal';

		modal = $dialog.dialog({
			templateUrl: '/templates/modals/discharge_patient.html/',
			controller: 'DischargePatientCtrl',
			resolve: {
				patient: function() { return patient; },
				currentTag: function() { return $scope.currentTag; },
			}
		});

		modal.open().then(function(result) {
			$scope.state = 'normal';

			if (result == 'discharged') {
				$scope.rows = getVisiblePatients();
				$scope.selectItem(0, $scope.cix, 0);
			};
		});
	};

	$scope.editItem = function(rix, cix, iix) {
		var modal;
		var columnName = getColumnName(cix);
		var patient = getPatient(rix);
		var item;

		if (iix == patient.getNumberOfItems(columnName)) {
			item = patient.newItem(columnName);
		} else {
			item = patient.getItem(columnName, iix);
		}

		$scope.selectItem(rix, cix, iix);
		$scope.state = 'modal';

		modal = $dialog.dialog({
			templateUrl: '/templates/modals/' + columnName + '.html/',
			controller: 'EditItemCtrl',
			resolve: {
				item: function() { return item; },
				options: function() { return options; },
			},
		});

		modal.open().then(function(result) {
			$scope.state = 'normal';

			if (columnName == 'location') {
				// User may have removed current tag
				$scope.rows = getVisiblePatients();
				$scope.selectItem(getRowIxFromPatientId(patient.id), $scope.cix, 0);
			}

			if (result == 'add-another') {
				$scope.editItem(rix, cix, patient.getNumberOfItems(columnName));
			};
		});
	};

	$scope.deleteItem = function(rix, cix, iix) {
		var modal;
		var columnName = getColumnName(cix);
		var patient = getPatient(rix);
		var item = patient.getItem(columnName, iix);

		if (schema.isSingleton(columnName)) {
			// Cannot delete singleton
			return;
		}

		if (!angular.isDefined(item)) {
			// Cannot delete 'Add'
			return;
		}

		$scope.state = 'modal'
		modal = $dialog.dialog({
			templateUrl: '/templates/modals/delete_item_confirmation.html/',
			controller: 'DeleteItemConfirmationCtrl',
			resolve: {
				item: function() { return item; },
			},
		});

		modal.open().then(function(result) {
			$scope.state = 'normal';
		});
	};

	$scope.mouseEnter = function(rix, cix) {
		$scope.mouseRix = rix;
		$scope.mouseCix = cix;
	}

	$scope.mouseLeave = function() {
		$scope.mouseRix = -1;
		$scope.mouseCix = -1;
	}

        function showKeyboardShortcuts(){
		// TODO fix this
                $('#keyboard-shortcuts').modal();
        };

	function goLeft() {
		if ($scope.cix > 0) {
			$scope.cix--;
			$scope.iix = 0;
		};
	};

	function goRight() {
		if ($scope.cix < $scope.columns.length - 1) {
			$scope.cix++;
			$scope.iix = 0;
		};
	};

	function goUp() {
		var patient = getPatient($scope.rix);
		var columnName = getColumnName($scope.cix);

		if ($scope.iix > 0) {
			$scope.iix--;
		} else if ($scope.rix > 0) {
			$scope.rix--;
			if (!schema.isSingleton(columnName)) {
				$scope.iix = patient.getNumberOfItems(columnName);
			};
		};
	};

	function goDown() {
		var patient = getPatient($scope.rix);
		var columnName = getColumnName($scope.cix);

		if (!schema.isSingleton(columnName) &&
		    ($scope.iix < patient.getNumberOfItems(columnName))) {
			$scope.iix++;
		} else if ($scope.rix < $scope.rows.length - 1) {
			$scope.rix++;
			$scope.iix = 0;
		};
	};
});

controllers.controller('PatientDetailCtrl', function($scope, $http, schema, patient) {
	// TODO reinstate some of this
});

controllers.controller('SearchCtrl', function($scope, $http, $location) {
	$scope.searchTerms = {
		hospital_number: '',
		name: '',
	};
	$scope.results = [];
	$scope.searched = false;

	$scope.patient_category_list = ['Inpatient', 'Review'];
	$scope.hospital_list = ['Heart Hospital', 'NHNN', 'UCH'];

	$scope.doSearch = function() {
		var queryParams = [];
		var queryString;

		for (var term in $scope.searchTerms) {
			if ($scope.searchTerms[term] != '') {
				queryParams.push(term + '=' + $scope.searchTerms[term]);
			};
		};

		if (queryParams.length == 0) {
			return;
		};

		queryString = queryParams.join('&');

		$http.get('search/?' + queryString).success(function(results) {
			$scope.searched = true;
			$scope.results = results.patients;
		});
	};

	$scope.startAdd = function() {
		$scope.editing = {
			location: {date_of_admission: new Date()},
		       	demographics: {},
		       	tags: {}
		};
		if ($scope.results.length == 0) {
			$scope.editing.demographics.name = $scope.searchTerms.name;
			$scope.editing.demographics.hospital_number = $scope.searchTerms.hospital_number;
		}
		$('#add-new-modal').modal();
		$('#add-new-modal').find('input,textarea').first().focus();
	}

	$scope.findByHospitalNumber = function() {
		var hospitalNumber = $scope.editing.demographics.hospital_number
		$http.get('search/?hospital_number=' + hospitalNumber).success(function(results) {
			$scope.foundPatient = true; // misnomer: might not actually have found a patient!
			if (results.patients.length == 1) {
				$scope.editing.demographics = clone(results.patients[0].demographics);
				$scope.editing.location = clone(results.patients[0].location);
				$scope.editing.tags = clone(results.patients[0].tags);
			}
			$scope.editing.tags[$scope.currentTag] = true;
		});
	};

	function clearModal(columnName) {
		$('#' + columnName + '-modal').modal('hide')

		// See https://github.com/openhealthcare/opal/issues/28
		$(".btn").blur();
	};

	$scope.saveAdd = function() {
		clearModal('add-new');
		$http.post('patient/', $scope.editing).success(function(patient) {
			$location.path('patient/' + patient.id);
		});
	};

	$scope.cancelAdd = function() {
		state = 'normal';
		clearModal('add-new');
	};
});

controllers.controller('AddPatientCtrl', function($scope, $http, dialog, options, currentTag) {
	for (var name in options) {
		$scope[name + '_list'] = options[name];
	};
	$scope.patient_category_list = ['Inpatient', 'Review'];

	$scope.foundPatient = false; // Display rest of form when true
	$scope.findingPatient = false; // Disable Search button when true
	$scope.editing = {
		location: {
			date_of_admission: moment().format('DD/MM/YYYY'),
			tags: {},
		},
		demographics: {},
	};

	$scope.findByHospitalNumber = function() {
		var hospitalNumber = $scope.editing.demographics.hospital_number
		$scope.findingPatient = true;
		$http.get('patient/?hospital_number=' + hospitalNumber).success(function(results) {
			$scope.findingPatient = false;
			$scope.foundPatient = true; // misnomer: might not actually have found a patient!
			if (results.length == 1) {
				$scope.editing.demographics = results[0].demographics[0];
				$scope.editing.location = results[0].location[0]
			}
			$scope.editing.location.tags[currentTag] = true;
		});
	};

	$scope.save = function() {
		var value;

		// This is a bit mucky but will do for now
		value = $scope.editing.location.date_of_admission;
		if (value) {
			$scope.editing.location.date_of_admission = moment(value, 'DD/MM/YYYY').format('YYYY-MM-DD');
		}

		value = $scope.editing.demographics.date_of_birth;
		if (value) {
			$scope.editing.demographics.date_of_birth = moment(value, 'DD/MM/YYYY').format('YYYY-MM-DD');
		}

		$http.post('patient/', $scope.editing).success(function(patient) {
			dialog.close(patient);
		});
	};

	$scope.cancel = function() {
		dialog.close('cancel');
	};
});

controllers.controller('EditItemCtrl', function($scope, dialog, item, options) {
	$scope.editing = item.makeCopy();
	$scope.editingName = item.patientName;

	for (var name in options) {
		$scope[name + '_list'] = options[name];
	};
	$scope.patient_category_list = ['Inpatient', 'Review'];

	$scope.save = function() {
		item.save($scope.editing).then(function() {
			dialog.close('saved');
		});
	};

	$scope.cancel = function() {
		dialog.close('cancel');
	};
});

controllers.controller('DeleteItemConfirmationCtrl', function($scope, $http, dialog, item) {
	$scope.destroy = function() {
		item.destroy().then(function() {
			dialog.close('deleted');
		});
	};

	$scope.cancel = function() {
		dialog.close('cancel');
	};
});

controllers.controller('DischargePatientCtrl', function($scope, $http, dialog, patient, currentTag) {
	var currentCategory = patient.location[0].category;
	var newCategory;

	if (currentCategory == 'Inpatient') {
		newCategory = 'Discharged';
	} else if (currentCategory == 'Review' || currentCategory == 'Followup') {
		newCategory = 'Unfollow';
	} else {
		newCategory = currentCategory;
	}

	$scope.editing = {
		category: newCategory,
		//date: new Date()
	};

	$scope.discharge = function() {
		var location = patient.getItem('location', 0);
		var attrs = location.makeCopy();

		if ($scope.editing.category != 'Unfollow') {
			attrs.category = $scope.editing.category;
			attrs.discharge_date = $scope.editing.discharge_date;
		}

		if ($scope.editing.category != 'Followup') {
			attrs.tags[currentTag] = false;
		}

		location.save(attrs).then(function() {
			dialog.close('discharged');
		});
	};

	$scope.cancel = function() {
		dialog.close('cancel');
	};
});
