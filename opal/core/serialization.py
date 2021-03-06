"""
Opal [de]seralization helpers
"""
import collections
import datetime

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone
from django.utils.dateformat import format
import six


def deserialize_datetime(value):
    """
    Given a VALUE, deserialize it to a datetime
    """
    if isinstance(value, datetime.datetime):
        return value

    input_format = settings.DATETIME_INPUT_FORMATS[0]
    value = timezone.make_aware(datetime.datetime.strptime(
        value, input_format
    ), timezone.get_current_timezone())

    return value


def deserialize_time(value):
    """
    Given a VALUE, deserialize it to a time
    """
    if isinstance(value, datetime.time):
        return value

    input_format = settings.TIME_INPUT_FORMATS[0]
    value = timezone.make_aware(datetime.datetime.strptime(
        value, input_format
    ), timezone.get_current_timezone()).time()

    return value


def deserialize_date(value):
    """
    Given a VALUE, deserialize it to a date
    """
    if isinstance(value, datetime.date):
        return value

    input_format = settings.DATE_INPUT_FORMATS[0]
    dt = datetime.datetime.strptime(
        value, input_format
    )
    dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt.date()


def _temporal_thing_to_string(thing):
    """
    If THING is a time, date, or datetime, return a string representation of it
    otherwise, return THING unchanged.
    """
    if isinstance(thing, datetime.time):
        return format(thing, settings.TIME_FORMAT)
    elif isinstance(thing, datetime.datetime):
        return format(thing, settings.DATETIME_FORMAT)
    elif isinstance(thing, datetime.date):
        return format(
            datetime.datetime.combine(
                thing, datetime.datetime.min.time()
            ), settings.DATE_FORMAT
        )
    else:
        return thing


class OpalSerializer(DjangoJSONEncoder):
    """
    Render a dict as JSON
    """
    def default(self, o):
        if isinstance(o, six.binary_type):
            return o.decode('utf-8')

        if isinstance(o, list) or isinstance(o, tuple):
            return [_temporal_thing_to_string(i) for i in o]

        if isinstance(o, collections.Mapping):
            return {
                _temporal_thing_to_string(k): _temporal_thing_to_string(v)
                for k, v in o.items()
            }

        old_type = type(o)
        o = _temporal_thing_to_string(o)
        if type(o) != old_type:
            # We converted a date / time / datetime so return now without super
            return o

        # o is not a type we know how to handle so we
        # fall back to DjangoJSONEncoder
        super(OpalSerializer, self).default(o)
